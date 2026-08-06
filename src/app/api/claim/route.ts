import { NextResponse } from "next/server";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { claimedSince, recordClaim, migrate, isConfigured } from "@/lib/store";
import { payout, treasuryAddress } from "@/lib/treasury";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** What one address may take in a rolling day, and per request. */
const PER_REQUEST_SOL = 1;
const DAILY_CAP_SOL = 5;
const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Hands devnet SOL from the treasury to a developer.
 *
 * The cap here is ours, not an upstream faucet's. It exists so one person
 * cannot drain a pool that took eight hours to fill.
 */
export async function POST(req: Request) {
  if (!isConfigured() || !treasuryAddress()) {
    return NextResponse.json(
      { error: "Spigot is not connected to a treasury yet." },
      { status: 503 },
    );
  }

  let body: { address?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send a JSON body." }, { status: 400 });
  }

  if (typeof body.address !== "string") {
    return NextResponse.json({ error: "An address is required." }, { status: 400 });
  }

  let recipient: PublicKey;
  try {
    recipient = new PublicKey(body.address);
  } catch {
    return NextResponse.json({ error: "That is not a valid Solana address." }, { status: 400 });
  }

  await migrate();

  const takenLamports = await claimedSince(recipient.toBase58(), Date.now() - WINDOW_MS);
  const capLamports = DAILY_CAP_SOL * LAMPORTS_PER_SOL;
  const wanted = PER_REQUEST_SOL * LAMPORTS_PER_SOL;

  if (takenLamports + wanted > capLamports) {
    const remaining = Math.max(0, capLamports - takenLamports) / LAMPORTS_PER_SOL;
    return NextResponse.json(
      {
        error: `This address has ${remaining.toFixed(2)} SOL left in its daily allowance.`,
        takenSol: takenLamports / LAMPORTS_PER_SOL,
        capSol: DAILY_CAP_SOL,
      },
      { status: 429 },
    );
  }

  try {
    const signature = await payout(recipient, wanted);
    await recordClaim(recipient.toBase58(), wanted, signature);

    return NextResponse.json({
      sol: PER_REQUEST_SOL,
      signature,
      explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
