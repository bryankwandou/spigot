import type { Event, Outcome } from "./store";

/**
 * Turning a pile of outcomes into one word a tired developer can act on.
 *
 * The honest constraint here is cadence. The scheduled probe runs every nine
 * hours, because that is the tightest interval the upstream's own eight-hour
 * limit permits with margin left over. A board fed that slowly cannot answer
 * "is it paying this second" — pretending otherwise would be inventing data.
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
 * How far back an observation still counts. Wide enough that the nine-hour
 * probe always leaves at least two inside it, so a single odd result never
 * stands alone as the whole picture.
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
