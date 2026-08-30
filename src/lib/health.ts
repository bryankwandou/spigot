import type { Event, Outcome } from "./store";

/**
 * Turning a pile of outcomes into one word a tired developer can act on.
 *
 * The honest constraint here is cadence. The scheduled probe waits eight hours
 * and three minutes after a grant, because that is the upstream's published
 * limit plus margin, and an hour after a refusal, because a refusal dispensed
 * nothing and started no cooldown. So the board is well informed during a dry
 * spell and deliberately quiet after a payout — which is the opposite of what a
 * live ticker would do, and the right way round for a limit we did not set.
 *
 * So it answers a question it can actually support: what happened the last time
 * anyone looked, and how long ago was that. The freshest observation sets the
 * status; the window behind it supplies a rate for context. Every response
 * carries `lastSeenAt` so the interface can print the age next to the verdict
 * and let the reader discount it themselves.
 *
 * Reports from developers are what make this tighten up. A probe guarantees a
 * floor of one observation per window; a busy afternoon of people clicking
 * through and saying what happened can push the freshest data point to minutes
 * old, and the same code reads better the moment that happens.
 */

/**
 * How far back an observation still counts. Wide enough that even the slowest
 * cadence — the eight-hour wait after a grant — always leaves at least two
 * inside it, so a single odd result never stands alone as the whole picture.
 */
export const HEALTH_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Past this age the freshest observation stops being reported as current. Set
 * a little above the probe interval so a board that is merely between probes
 * does not read as abandoned, while a genuinely stalled scheduler does.
 */
export const STALE_AFTER_MS = 10 * 60 * 60 * 1000;

export type Status = "flowing" | "patchy" | "dry" | "unknown";

export type Health = {
  status: Status;
  /** Share of observations in the window that paid out, 0..1. Null below two. */
  successRate: number | null;
  sample: number;
  lastGrantedAt: number | null;
  lastSeenAt: number | null;
  /** What the freshest observation actually was. */
  lastOutcome: Outcome | null;
  /** True when even the freshest observation is too old to speak for now. */
  stale: boolean;
};

function paid(o: Outcome): boolean {
  return o === "granted";
}

export function healthFor(faucetId: string, events: Event[], now = Date.now()): Health {
  const cutoff = now - HEALTH_WINDOW_MS;
  const mine = events
    .filter((e) => e.faucetId === faucetId && e.at >= cutoff)
    .sort((a, b) => b.at - a.at);

  const granted = mine.filter((e) => paid(e.outcome));
  const lastGrantedAt = granted.length ? granted[0].at : null;
  const freshest = mine[0] ?? null;
  const lastSeenAt = freshest ? freshest.at : null;
  const lastOutcome = freshest ? freshest.outcome : null;

  // Nothing to go on. Say so rather than guessing from an empty set.
  if (!freshest) {
    return {
      status: "unknown",
      successRate: null,
      sample: 0,
      lastGrantedAt: null,
      lastSeenAt: null,
      lastOutcome: null,
      stale: false,
    };
  }

  const stale = now - freshest.at > STALE_AFTER_MS;
  const successRate = mine.length >= 2 ? granted.length / mine.length : null;

  // A stale observation is history, not a status. Report the age and let the
  // reader decide; claiming a faucet is dry on twelve-hour-old evidence is the
  // kind of confident wrongness that sends someone to a dead page.
  if (stale) {
    return {
      status: "unknown",
      successRate,
      sample: mine.length,
      lastGrantedAt,
      lastSeenAt,
      lastOutcome,
      stale: true,
    };
  }

  // The freshest observation carries the verdict. Where the window holds enough
  // to disagree with it, a mixed record downgrades a lone success to "patchy" —
  // one lucky grant among refusals is not a working faucet.
  let status: Status;
  if (paid(freshest.outcome)) {
    status = successRate !== null && successRate < 0.6 ? "patchy" : "flowing";
  } else {
    status = successRate !== null && successRate > 0 ? "patchy" : "dry";
  }

  return { status, successRate, sample: mine.length, lastGrantedAt, lastSeenAt, lastOutcome, stale };
}

/** Plain-language summary for the dashboard header. */
export function describe(h: Health): string {
  if (h.status === "unknown") {
    return h.stale ? "no recent check" : "nothing observed yet";
  }
  switch (h.status) {
    case "flowing":
      return "paid out on the last check";
    case "patchy":
      return "paying some of the time";
    case "dry":
      return "refused on the last check";
  }
}

/**
 * How long past the target cadence before both schedulers are presumed down.
 *
 * Two of them point at the probe endpoint. GitHub Actions wakes hourly but is
 * free to drop scheduled runs entirely under load, and measurably does: over
 * one recent day it fired at intervals of 2.4, 3.9, 10.4, 10.0 and 8.3 hours
 * against a cron that asked for every thirty minutes. Vercel's own scheduler is
 * the floor underneath that — it runs daily, and it does not skip.
 *
 * So a gap of eleven hours means GitHub was unlucky, which is ordinary. A gap
 * past the daily floor plus two hours of slack means the floor failed too, and
 * that is not a stale reading — that is a broken deployment.
 */
export const SCHEDULER_FLOOR_MS = 26 * 60 * 60 * 1000;

export type SchedulerHealth = {
  lastProbeAt: number | null;
  /** When the next probe becomes permissible. Null before the first one. */
  dueAt: number | null;
  /** Milliseconds past `dueAt`, or 0 while still inside the window. */
  overdueByMs: number;
  /** False once the gap exceeds the guaranteed daily floor. */
  healthy: boolean;
};

/**
 * Whether the probe is still being called at all.
 *
 * The board already degrades honestly when its data goes stale — it prints
 * `unknown` and says so. What it could not previously say is *why*: a faucet
 * nobody has heard from and a scheduler that stopped calling look identical
 * from the outside, and only one of them is a bug to fix. This separates them.
 */
export function schedulerHealth(
  lastProbeAt: number | null,
  probeIntervalMs: number,
  now = Date.now(),
): SchedulerHealth {
  if (lastProbeAt === null) {
    return { lastProbeAt: null, dueAt: null, overdueByMs: 0, healthy: true };
  }
  const dueAt = lastProbeAt + probeIntervalMs;
  return {
    lastProbeAt,
    dueAt,
    overdueByMs: Math.max(0, now - dueAt),
    healthy: now - lastProbeAt <= SCHEDULER_FLOOR_MS,
  };
}
