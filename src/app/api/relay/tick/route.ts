import { NextResponse } from "next/server";
import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { probeable, isEligible, nextEligibleAt } from "@/lib/faucets";
import { treasuryKey, treasuryState } from "@/lib/treasury";
import { migrate, lastProbeAt, recordProbe, isConfigured, type Outcome } from "@/lib/store";

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
 * One attempt at the airdrop. Returns what the faucet said, not what we hoped.
 */
async function attempt(
  conn: Connection,
): Promise<{ outcome: Outcome; detail: string | null }> {
  try {
    const sig = await conn.requestAirdrop(treasuryKey(), LAMPORTS_PER_SOL * 2);
    const bh = await conn.getLatestBlockhash();
    await conn.confirmTransaction({ signature: sig, ...bh }, "confirmed");
    return { outcome: "granted", detail: sig };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const dry = /run dry|airdrop limit|429|Too Many Requests/i.test(msg);
    return {
      outcome: dry ? "dry" : "failed",
      detail: firstLine(msg),
    };
  }
}

/**
 * The scheduled collection.
 *
 * Every eight hours and three minutes, this asks the devnet airdrop once - twice
 * if the first answer was not a refusal on the merits - and sends whatever it
 * gets to the treasury address. That address is a public key. Crediting an
 * account needs no signature, so this deployment can fill the treasury while
 * holding no key, signing nothing, and being unable to move a lamport of what
 * it collects.
 *
 * The yield is honest rather than impressive, and the reason is measured. The
 * upstream meters on egress IP, and this runs on shared serverless egress that
 * thousands of people have already spent. Most ticks will be refused. What
 * makes the schedule worth running anyway is that devnet's airdrop is not dead,
 * only exhausted - it recovers, and a patient request placed every eight hours
 * is present when it does. Nobody has to sit and watch for the moment.
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
  const conn = new Connection(RPC, "confirmed");
  const probed: Array<{ faucetId: string; outcome: Outcome; detail: string | null }> = [];
  const skipped: Array<{ faucetId: string; readyAt: number }> = [];

  for (const f of probeable()) {
    const last = await lastProbeAt(f.id);
    if (!isEligible(f, last, now)) {
      skipped.push({ faucetId: f.id, readyAt: nextEligibleAt(f, last) });
      continue;
    }

    // Two attempts, as agreed, and no more. The second exists because a
    // transient RPC error is not the same as a refusal and should not cost the
    // whole eight-hour window. A genuine "run dry" is an answer, not a hiccup,
    // so it is taken at its word and not retried.
    let { outcome, detail } = await attempt(conn);
    if (outcome === "failed") {
      const second = await attempt(conn);
      outcome = second.outcome;
      detail = second.detail;
    }

    await recordProbe(f.id, outcome, detail);
    probed.push({ faucetId: f.id, outcome, detail });
  }

  // Read the account after the attempts rather than trusting them. A confirmed
  // signature and an unchanged balance is exactly the discrepancy worth seeing.
  const treasury = await treasuryState(conn);

  return NextResponse.json({ checkedAt: now, treasury, probed, skipped });
}

export const POST = tick;

/** Vercel's scheduler issues GET. Same work, same clock, same answer. */
export const GET = tick;
