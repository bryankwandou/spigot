import { NextResponse } from "next/server";
import { FAUCETS, nextEligibleAt, PROBE_INTERVAL_MS } from "@/lib/faucets";
import {
  healthFor,
  describe,
  schedulerHealth,
  HEALTH_WINDOW_MS,
  STALE_AFTER_MS,
} from "@/lib/health";
import { eventsSince, lastReportFor, lastProbeAt, isConfigured, migrate } from "@/lib/store";

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
    FAUCETS.map(async (f) => [f.id, await lastProbeAt(f.id)] as const),
  );
  const probedAt = Object.fromEntries(probes);

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
  const freshestProbe = Object.values(probedAt).reduce<number | null>(
    (a, b) => (b === null ? a : a === null ? b : Math.max(a, b)),
    null,
  );

  return NextResponse.json({
    ...shell,
    configured: true,
    scheduler: schedulerHealth(freshestProbe, PROBE_INTERVAL_MS, now),
    address,
    faucets,
  });
}
