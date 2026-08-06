import { NextResponse } from "next/server";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { serverCallable, isEligible, nextEligibleAt } from "@/lib/faucets";
import { getLastAttempt, recordAttempt, migrate, isConfigured } from "@/lib/store";
import { connection, treasuryAddress } from "@/lib/treasury";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Called by the scheduled workflow every 30 minutes.
 *
 * The schedule does not decide when a faucet may be called — this route does.
 * Each faucet is checked against its own cooldown plus the margin, and the ones
 * still inside their window are reported as skipped rather than attempted.
 * There is no retry loop and no second identity.
 */
export async function POST(req: Request) {
  const secret = process.env.RELAY_TOKEN;
  if (!secret) {
    return NextResponse.json({ error: "The relay has no token configured." }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }
  if (!isConfigured()) {
    return NextResponse.json({ error: "No database configured." }, { status: 503 });
  }

  const treasury = treasuryAddress();
  if (!treasury) {
    return NextResponse.json({ error: "No treasury address configured." }, { status: 503 });
  }

  await migrate();
  const conn = connection();
  const now = Date.now();

  const attempted: Array<Record<string, unknown>> = [];
  const skipped: Array<{ faucet: string; eligibleAt: number }> = [];

  for (const faucet of serverCallable()) {
    const last = await getLastAttempt(faucet.id);

    if (!isEligible(faucet, last, now)) {
      skipped.push({ faucet: faucet.id, eligibleAt: nextEligibleAt(faucet, last) });
      continue;
    }

    const lamports = Math.round(faucet.expectedSol * LAMPORTS_PER_SOL);

    try {
      const signature = await conn.requestAirdrop(treasury, lamports);
      const latest = await conn.getLatestBlockhash();
      const confirmation = await conn.confirmTransaction(
        { signature, ...latest },
        "confirmed",
      );

      if (confirmation.value.err) {
        const detail = JSON.stringify(confirmation.value.err);
        await recordAttempt(faucet.id, "failed", null, signature, detail);
        attempted.push({ faucet: faucet.id, outcome: "failed", signature, detail });
        continue;
      }

      await recordAttempt(faucet.id, "granted", lamports, signature);
      attempted.push({ faucet: faucet.id, outcome: "granted", lamports, signature });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      // Being told no is information worth keeping. Recording it means the next
      // window is measured from this moment, so we back off instead of pushing.
      const outcome = /429|rate|limit|too many/i.test(detail) ? "rate_limited" : "failed";
      await recordAttempt(faucet.id, outcome, null, null, detail);
      attempted.push({ faucet: faucet.id, outcome, detail });
    }
  }

  const balance = await conn.getBalance(treasury);

  return NextResponse.json({
    checkedAt: now,
    treasury: treasury.toBase58(),
    treasuryLamports: balance,
    attempted,
    skipped,
  });
}
