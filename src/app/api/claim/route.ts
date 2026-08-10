import { NextResponse } from "next/server";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { migrate, claimedSince, recordClaim, isConfigured } from "@/lib/store";
import { isFunded, payout, spendable, treasuryAddress } from "@/lib/treasury";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Not exported: a Next.js route module may only export handlers and a fixed
// set of config keys, and anything else fails the build rather than the
// typecheck. These belong to this file alone.

/** One request never takes more than this. */
const PER_REQUEST_LAMPORTS = 1 * LAMPORTS_PER_SOL;
/** And one address never takes more than this in a rolling day. */
const DAILY_CAP_LAMPORTS = 5 * LAMPORTS_PER_SOL;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Hand one SOL to a developer from the pool.
 *
 * The caps are the whole design. A pool filled by hand is small, and without a
 * ceiling the first script to find it would drain it in a minute and the
 * thousand people it was meant for would see an empty balance. One SOL is
 * enough to deploy a program and run a test suite, which is the actual need.
 *
 * Nothing here is sold. There is no fee, no token, and no mainnet path.
 */
export async function POST(req: Request) {
  if (!isFunded()) {
    return NextResponse.json(
      { error: "The pool is not configured yet.", treasury: treasuryAddress() },
      { status: 503 },
    );
  }

  // Without the ledger there is no way to enforce the daily cap, and paying out
  // blind would let one script empty a hand-filled pool in a minute. Refuse
  // clearly instead of letting the first query throw a 500.
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "The claim ledger is unavailable, so payouts are paused." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const { address } = (body ?? {}) as Record<string, unknown>;
  if (typeof address !== "string" || address.length === 0) {
    return NextResponse.json({ error: "address is required." }, { status: 400 });
  }

  let recipient: string;
  try {
    recipient = new PublicKey(address).toBase58();
  } catch {
    return NextResponse.json({ error: "address is not a valid Solana public key." }, { status: 400 });
  }

  await migrate();

  const already = await claimedSince(recipient, Date.now() - DAY_MS);
  const remaining = DAILY_CAP_LAMPORTS - already;
  if (remaining <= 0) {
    return NextResponse.json(
      {
        error: "This address has reached its daily limit.",
        dailyCapSol: DAILY_CAP_LAMPORTS / LAMPORTS_PER_SOL,
        claimedTodaySol: already / LAMPORTS_PER_SOL,
      },
      { status: 429 },
    );
  }

  const wanted = Math.min(PER_REQUEST_LAMPORTS, remaining);
  const available = await spendable();
  if (available < wanted) {
    return NextResponse.json(
      {
        error: "The pool is empty right now. The board below shows which faucets are paying.",
        availableSol: available / LAMPORTS_PER_SOL,
      },
      { status: 503 },
    );
  }

  let signature: string;
  try {
    signature = await payout(recipient, wanted);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg.split("\n")[0].slice(0, 300) }, { status: 502 });
  }

  await recordClaim(recipient, wanted, signature);

  return NextResponse.json({
    sol: wanted / LAMPORTS_PER_SOL,
    signature,
    explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
  });
}
