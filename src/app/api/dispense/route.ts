import { NextResponse } from "next/server";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { PROBE_INTERVAL_MS } from "@/lib/faucets";
import {
  TIERS,
  isTier,
  dispense,
  treasuryState,
  RESERVE_LAMPORTS,
} from "@/lib/treasury";
import {
  migrate,
  isConfigured,
  lastDispenseAt,
  recordDispense,
} from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

/**
 * One grant per address per window.
 *
 * The same interval the probe obeys, for the same reason: this account is
 * filled by a faucet that pays once every eight hours at best, so handing out
 * faster than it fills would empty it for everyone in favour of whoever wrote
 * the first loop. Six fixed sizes rather than a free-form amount keeps that
 * fair in the other direction too - nobody can ask for the whole balance.
 */
const GRANT_GAP_MS = PROBE_INTERVAL_MS;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    address?: unknown;
    sol?: unknown;
  } | null;

  if (!body || typeof body.address !== "string") {
    return NextResponse.json({ error: "Send an address." }, { status: 400 });
  }

  let to: PublicKey;
  try {
    to = new PublicKey(body.address.trim());
  } catch {
    return NextResponse.json({ error: "That is not a Solana address." }, { status: 400 });
  }

  if (!isTier(body.sol)) {
    return NextResponse.json(
      { error: `Pick one of ${TIERS.join(", ")} SOL.`, tiers: TIERS },
      { status: 400 },
    );
  }
  const sol = body.sol;
  const address = to.toBase58();

  if (!isConfigured()) {
    return NextResponse.json(
      { error: "No database, so turns cannot be tracked. The dispenser is closed." },
      { status: 503 },
    );
  }
  await migrate();

  const last = await lastDispenseAt(address);
  if (last !== null && Date.now() - last < GRANT_GAP_MS) {
    const retryAt = last + GRANT_GAP_MS;
    return NextResponse.json(
      {
        error: "This address has already had its turn. Come back when the clock runs out.",
        retryAt,
        retryInMs: retryAt - Date.now(),
      },
      { status: 429 },
    );
  }

  const conn = new Connection(RPC, "confirmed");
  const state = await treasuryState(conn);

  if (state.lamports === null) {
    return NextResponse.json(
      { error: "The treasury balance could not be read. Nothing was sent." },
      { status: 503 },
    );
  }

  // Checked here as well as in the client so the answer is truthful even when
  // the request did not come from our own page.
  const spendable = state.lamports - RESERVE_LAMPORTS;
  if (sol * LAMPORTS_PER_SOL > spendable) {
    return NextResponse.json(
      {
        error:
          state.affordableTier === null
            ? "The treasury is empty. It refills from the faucet, which is refusing us too."
            : `Only ${state.affordableTier} SOL is available right now.`,
        affordableTier: state.affordableTier,
        treasurySol: state.sol,
      },
      { status: 409 },
    );
  }

  let signature: string;
  try {
    signature = await dispense(conn, to, sol);
  } catch (e) {
    // Nothing is written down, so the caller keeps their turn. A failed send
    // must not cost someone eight hours.
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "The transfer did not go through. Your turn is intact.", detail: msg.slice(0, 200) },
      { status: 502 },
    );
  }

  await recordDispense(address, sol, signature);

  return NextResponse.json({
    sent: sol,
    address,
    signature,
    explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    nextEligibleAt: Date.now() + GRANT_GAP_MS,
  });
}
