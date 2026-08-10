import { NextResponse } from "next/server";
import { FAUCETS, nextEligibleAt } from "@/lib/faucets";
import { healthFor, describe, HEALTH_WINDOW_MS } from "@/lib/health";
import { eventsSince, lastReportFor, isConfigured, migrate } from "@/lib/store";
import { treasuryAddress, treasuryBalance, isFunded } from "@/lib/treasury";

export const dynamic = "force-dynamic";

/**
 * The board. Public, no auth, no key material in the response.
 *
 * Pass `?address=` and the per-faucet clock becomes that address's clock rather
 * than a generic one. Nothing is stored by this call — reading is free and
 * anonymous; only an explicit report writes anything down.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const address = url.searchParams.get("address")?.trim() || null;
  const now = Date.now();

  // The two subsystems fail independently. A missing database costs the health
  // signal and the personal clock, but the pool is on-chain and still has a
  // balance worth showing, so report it rather than blanking the whole page.
  if (!isConfigured()) {
    return NextResponse.json(
      {
        now,
        configured: false,
        windowMs: HEALTH_WINDOW_MS,
        treasury: {
          address: treasuryAddress(),
          lamports: isFunded() ? await treasuryBalance() : null,
        },
        faucets: FAUCETS.map((f) => ({
          ...f,
          health: { status: "unknown", successRate: null, sample: 0, lastGrantedAt: null, lastSeenAt: null },
          summary: "no database configured",
          yourNextEligibleAt: null,
        })),
      },
      { status: 200 },
    );
  }

  await migrate();

  const events = await eventsSince(now - HEALTH_WINDOW_MS);
  const mine = address ? await lastReportFor(address) : {};

  const faucets = FAUCETS.map((f) => {
    const health = healthFor(f.id, events, now);
    const lastYours = mine[f.id] ?? null;
    return {
      id: f.id,
      label: f.label,
      access: f.access,
      meters: f.meters,
      cooldownMs: f.cooldownMs,
      expectedSol: f.expectedSol,
      claimUrl: f.claimUrl,
      terms: f.terms,
      note: f.note,
      health,
      summary: describe(health),
      yourLastClaimAt: lastYours,
      yourNextEligibleAt: lastYours === null ? 0 : nextEligibleAt(f, lastYours),
    };
  });

  // Address and balance only. The secret never leaves the server process.
  const treasury = {
    address: treasuryAddress(),
    lamports: isFunded() ? await treasuryBalance() : null,
  };

  return NextResponse.json({
    now,
    configured: true,
    address,
    windowMs: HEALTH_WINDOW_MS,
    treasury,
    faucets,
  });
}
