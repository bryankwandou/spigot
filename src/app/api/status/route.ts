import { NextResponse } from "next/server";
import { FAUCETS, nextEligibleAt } from "@/lib/faucets";
import { getLastAttempt, recentAttempts, isConfigured } from "@/lib/store";
import { connection, treasuryAddress } from "@/lib/treasury";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public read model behind the dashboard.
 *
 * Everything here is already public: an address, a balance, timestamps, and
 * transaction signatures anyone can look up on an explorer. No secret touches
 * this response.
 */
export async function GET() {
  const treasury = treasuryAddress();

  if (!treasury || !isConfigured()) {
    return NextResponse.json({
      ready: false,
      reason: "Spigot has not been given a treasury and a database yet.",
      faucets: FAUCETS.map((f) => ({
        id: f.id,
        label: f.label,
        access: f.access,
        cooldownMs: f.cooldownMs,
        expectedSol: f.expectedSol,
        terms: f.terms,
        lastAttempt: null,
        eligibleAt: 0,
      })),
      attempts: [],
    });
  }

  const balance = await connection().getBalance(treasury);

  const faucets = await Promise.all(
    FAUCETS.map(async (f) => {
      const last = await getLastAttempt(f.id);
      return {
        id: f.id,
        label: f.label,
        access: f.access,
        cooldownMs: f.cooldownMs,
        expectedSol: f.expectedSol,
        terms: f.terms,
        lastAttempt: last,
        eligibleAt: nextEligibleAt(f, last),
      };
    }),
  );

  return NextResponse.json({
    ready: true,
    now: Date.now(),
    treasury: treasury.toBase58(),
    treasuryLamports: balance,
    faucets,
    attempts: await recentAttempts(20),
  });
}
