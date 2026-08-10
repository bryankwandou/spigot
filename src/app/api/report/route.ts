import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { byId } from "@/lib/faucets";
import { migrate, recordReport, isConfigured, type Outcome } from "@/lib/store";

export const dynamic = "force-dynamic";

const ALLOWED: Outcome[] = ["granted", "rate_limited", "dry", "failed"];

/**
 * A developer telling the board what happened when they clicked through.
 *
 * This is the whole engine. One person finding a faucet dry is a wasted
 * afternoon; a hundred people saying so within the hour is a live signal that
 * saves the next thousand the same trip.
 *
 * The address is validated as a real ed25519 public key so the log cannot be
 * stuffed with junk, and it is only ever a devnet address the caller chose to
 * share. No signature is demanded — asking someone to sign a transaction to
 * report a broken faucet would cost more than the report is worth.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const { faucetId, address, outcome } = (body ?? {}) as Record<string, unknown>;

  const faucet = typeof faucetId === "string" ? byId(faucetId) : undefined;
  if (!faucet) {
    return NextResponse.json({ error: "Unknown faucetId." }, { status: 400 });
  }

  if (typeof outcome !== "string" || !ALLOWED.includes(outcome as Outcome)) {
    return NextResponse.json(
      { error: `outcome must be one of ${ALLOWED.join(", ")}.` },
      { status: 400 },
    );
  }

  if (typeof address !== "string" || address.length === 0) {
    return NextResponse.json({ error: "address is required." }, { status: 400 });
  }

  let normalized: string;
  try {
    normalized = new PublicKey(address).toBase58();
  } catch {
    return NextResponse.json({ error: "address is not a valid Solana public key." }, { status: 400 });
  }

  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Reports are unavailable while the database is not configured." },
      { status: 503 },
    );
  }

  await migrate();
  await recordReport(faucet.id, normalized, outcome as Outcome);

  return NextResponse.json({ recorded: true, faucetId: faucet.id, outcome });
}
