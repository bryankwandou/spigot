import { NextResponse } from "next/server";
import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { probeable, isProbeDue, nextProbeAt, endpointFor } from "@/lib/faucets";
import { treasuryKey, treasuryState } from "@/lib/treasury";
import { migrate, lastProbe, recordProbe, isConfigured, type Outcome } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

/**
 * Two schedulers call this, and either is allowed to.
 *
 * `RELAY_TOKEN` is the GitHub Actions workflow. `CRON_SECRET` is Vercel's own
 * scheduler, which injects that header itself. Neither is trusted more than the
 * other because neither decides anything: the cooldown clock lives in
 * `faucets.ts`, so an extra caller can only ever be told "not yet".
 */
function authorized(req: Request): boolean {
  const header = req.headers.get("authorization");
  if (!header) return false;
  const accepted = [process.env.RELAY_TOKEN, process.env.CRON_SECRET].filter(
    (t): t is string => Boolean(t),
  );
  return accepted.some((t) => header === `Bearer ${t}`);
}

/** First line only. Faucet errors arrive with stack traces we have no use for. */
function firstLine(msg: string): string {
  return msg.split("\n")[0].slice(0, 300);
}

/**
 * What a refusal actually was.
 *
 * The difference decides how long to wait, so guessing it wrongly is expensive
 * in both directions. A quota that is explicitly ours — "1 SOL per project per
 * day" — is a real cooldown and deserves the full published wait; hammering it
 * hourly is two dozen pointless requests against an allowance of one.
 *
 * A pool that has run dry is the opposite: it took nothing from us and started
 * no clock, and it can refill at any moment.
 *
 * Where the upstream is genuinely ambiguous this errs toward "dry" and the
 * shorter wait. The shared devnet RPC answers "you've either reached your
 * airdrop limit today or the airdrop faucet has run dry", which is two
 * different answers in one sentence, and it has been observed refusing from
 * unrelated egress addresses at the same moment — so the pool is the better
 * reading of it.
 */
function classify(msg: string): Outcome {
  if (/per project|per key|per day|quota/i.test(msg)) return "rate_limited";
  if (/run dry|airdrop limit|429|Too Many Requests|rate limit/i.test(msg)) return "dry";
  return "failed";
}

/**
 * One attempt at the airdrop. Returns what the faucet said, not what we hoped.
 *
 * The size asked for is the faucet's own published grant. Asking for more than
 * a provider allows is refused outright rather than trimmed, so a fixed two SOL
 * would have meant a provider with a one SOL daily allowance could never pay us
 * anything at all, while reporting a rate limit that was really our own bad
 * arithmetic.
 */
async function attempt(
  conn: Connection,
  sol: number,
): Promise<{ outcome: Outcome; detail: string | null }> {
  try {
    const sig = await conn.requestAirdrop(treasuryKey(), Math.round(sol * LAMPORTS_PER_SOL));
    const bh = await conn.getLatestBlockhash();
    await conn.confirmTransaction({ signature: sig, ...bh }, "confirmed");
    return { outcome: "granted", detail: sig };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { outcome: classify(msg), detail: firstLine(msg) };
  }
}

/**
 * The scheduled collection.
 *
 * This asks the devnet airdrop once - twice if the first answer was not a
 * refusal on the merits - and sends whatever it gets to the treasury address.
 * That address is a public key. Crediting an account needs no signature, so
 * this deployment can fill the treasury while holding no key, signing nothing,
 * and being unable to move a lamport of what it collects.
 *
 * How long it then waits depends on the answer. A grant costs the upstream real
 * SOL and buys it the full eight hours and three minutes it asks for. A refusal
 * cost it nothing and buys it an hour, because the pool it is guarding refills
 * and empties on a scale of minutes and sleeping through that is the difference
 * between collecting something and collecting nothing.
 *
 * The yield is honest rather than impressive, and the reason is measured. The
 * upstream meters on egress IP, and this runs on shared serverless egress that
 * thousands of people have already spent. Most ticks will be refused. What
 * makes the schedule worth running anyway is that devnet's airdrop is not dead,
 * only exhausted - it recovers, and a request placed every hour through the dry
 * spell is present when it does. Nobody has to sit and watch for the moment.
 *
 * Every attempt is written down whether it paid or not, which is what turns a
 * collector into a health board: the refusals are the signal other developers
 * actually need.
 *
 * Anything still inside its window is reported as skipped and not touched.
 * Calling this more often than necessary is free and by design: two independent
 * schedulers point at it, and the duplicate is answered with a skip.
 */
async function tick(req: Request) {
  if (!process.env.RELAY_TOKEN && !process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "Neither RELAY_TOKEN nor CRON_SECRET is configured." },
      { status: 503 },
    );
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // The probe log is also the cooldown clock. Without it there is no record of
  // when we last asked, and probing anyway would risk going in early — exactly
  // the mistake the margin exists to prevent. Stand down instead.
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "No database, so the cooldown clock is unreadable. Nothing probed." },
      { status: 503 },
    );
  }

  await migrate();

  const now = Date.now();
  const probed: Array<{ faucetId: string; outcome: Outcome; detail: string | null }> = [];
  const skipped: Array<{ faucetId: string; readyAt: number }> = [];
  const unconfigured: string[] = [];

  for (const f of probeable()) {
    // Each provider is called at its own endpoint, on its own key, inside its
    // own published window. That is what makes several sources honest rather
    // than one source wearing several hats: nothing here pretends to be a
    // different caller than it is.
    const endpoint = endpointFor(f, process.env);
    if (endpoint === null) {
      unconfigured.push(f.id);
      continue;
    }

    const last = await lastProbe(f.id);
    if (!isProbeDue(f, last, now)) {
      skipped.push({ faucetId: f.id, readyAt: nextProbeAt(f, last) });
      continue;
    }

    const conn = new Connection(endpoint, "confirmed");

    // Two attempts, as agreed, and no more. The second exists because a
    // transient RPC error is not the same as a refusal and should not cost the
    // whole eight-hour window. A genuine "run dry" is an answer, not a hiccup,
    // so it is taken at its word and not retried.
    let { outcome, detail } = await attempt(conn, f.expectedSol);
    if (outcome === "failed") {
      const second = await attempt(conn, f.expectedSol);
      outcome = second.outcome;
      detail = second.detail;
    }

    await recordProbe(f.id, outcome, detail);
    probed.push({ faucetId: f.id, outcome, detail });
  }

  // Read the account after the attempts rather than trusting them. A confirmed
  // signature and an unchanged balance is exactly the discrepancy worth seeing.
  // Read it from the shared endpoint, which is the one whose view of the chain
  // the board and the dispenser both use.
  const treasury = await treasuryState(new Connection(RPC, "confirmed"));

  return NextResponse.json({ checkedAt: now, treasury, probed, skipped, unconfigured });
}

export const POST = tick;

/** Vercel's scheduler issues GET. Same work, same clock, same answer. */
export const GET = tick;
