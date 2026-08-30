import { NextResponse } from "next/server";
import {
  FAUCETS,
  byId,
  nextEligibleAt,
  probeIntervalFor,
  isProbeConfigured,
  PROBE_INTERVAL_MS,
  RETRY_INTERVAL_MS,
} from "@/lib/faucets";
import {
  healthFor,
  describe,
  schedulerHealth,
  HEALTH_WINDOW_MS,
  STALE_AFTER_MS,
} from "@/lib/health";
import {
  eventsSince,
  lastReportFor,
  lastProbe,
  isConfigured,
  migrate,
  dispenseTotals,
} from "@/lib/store";
import { Connection } from "@solana/web3.js";
import { treasuryState, TIERS } from "@/lib/treasury";
import { capacityOf } from "@/lib/capacity";
import type { Outcome } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * The board. Public, no auth, nothing to sign, nothing stored by reading it.
 *
 * Pass `?address=` and the per-faucet clock becomes that address's clock rather
 * than a generic one. Reading stays anonymous either way — only an explicit
 * report writes anything down.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const address = url.searchParams.get("address")?.trim() || null;
  const now = Date.now();

  const shell = {
    now,
    windowMs: HEALTH_WINDOW_MS,
    staleAfterMs: STALE_AFTER_MS,
    probeIntervalMs: PROBE_INTERVAL_MS,
    retryIntervalMs: RETRY_INTERVAL_MS,
  };

  // Without the database there is no observation log, so every verdict would be
  // invented. Serve the registry — the URLs and published limits are static and
  // still worth something — and mark the health as unknown rather than blank
  // the page.
  if (!isConfigured()) {
    return NextResponse.json({
      ...shell,
      configured: false,
      scheduler: { lastProbeAt: null, dueAt: null, overdueByMs: 0, healthy: false },
      faucets: FAUCETS.map((f) => ({
        ...f,
        health: {
          status: "unknown",
          successRate: null,
          sample: 0,
          lastGrantedAt: null,
          lastSeenAt: null,
          lastOutcome: null,
          stale: false,
        },
        summary: "no database configured",
        lastProbeAt: null,
        yourLastClaimAt: null,
        yourNextEligibleAt: null,
      })),
    });
  }

  await migrate();

  const events = await eventsSince(now - HEALTH_WINDOW_MS);
  const mine = address ? await lastReportFor(address) : {};
  const probes = await Promise.all(
    FAUCETS.map(async (f) => [f.id, await lastProbe(f.id)] as const),
  );
  const lastByFaucet = Object.fromEntries(probes);
  const probedAt = Object.fromEntries(
    probes.map(([id, last]) => [id, last === null ? null : last.at] as const),
  );

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
      lastProbeAt: probedAt[f.id] ?? null,
      yourLastClaimAt: lastYours,
      yourNextEligibleAt: lastYours === null ? 0 : nextEligibleAt(f, lastYours),
    };
  });

  // The freshest probe across every server-reachable faucet. If this is far
  // enough behind, the fault is the scheduler rather than the faucets, and the
  // board should be able to say which.
  const freshest = probes
    .filter((p): p is readonly [string, { at: number; outcome: Outcome }] => p[1] !== null)
    .sort((a, b) => b[1].at - a[1].at)[0];
  const freshestProbe = freshest ? freshest[1].at : null;

  // The gap the scheduler is judged against is the one that actually applies,
  // which depends on what the last probe was told. Reporting a due time eight
  // hours out while the probe is really retrying hourly would make a stalled
  // scheduler look patient.
  const dueInterval = freshest
    ? probeIntervalFor(byId(freshest[0]) ?? FAUCETS[0], freshest[1].outcome)
    : PROBE_INTERVAL_MS;

  const treasury = await treasuryState(
    new Connection(process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com", "confirmed"),
  );

  return NextResponse.json({
    ...shell,
    configured: true,
    scheduler: schedulerHealth(freshestProbe, dueInterval, now),
    tiers: TIERS,
    treasury,
    // What it can actually pay out, and how fast it refills. A balance alone
    // does not answer "will it pay me, and if not, when", which is the only
    // question anyone arriving here has.
    capacity: capacityOf(
      treasury.lamports,
      FAUCETS.filter((f) => f.access === "server" && isProbeConfigured(f, process.env)),
    ),
    dispensed: await dispenseTotals(),
    address,
    faucets,
  });
}
