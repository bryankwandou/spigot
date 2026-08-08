import type { Event, Outcome } from "./store";

/**
 * Turning a pile of outcomes into one word a tired developer can act on.
 *
 * The window is deliberately short. A faucet that paid out this morning and is
 * empty now should read as empty now — a longer average would smear the two
 * together and send someone to a dead page, which is the exact failure this
 * project exists to prevent.
 */

export const HEALTH_WINDOW_MS = 90 * 60 * 1000;

/** Below this many observations the sample is too thin to call. */
const MIN_SAMPLE = 3;

export type Status = "flowing" | "patchy" | "dry" | "unknown";

export type Health = {
  status: Status;
  /** Share of observations that paid out, 0..1. Null when the sample is thin. */
  successRate: number | null;
  sample: number;
  lastGrantedAt: number | null;
  lastSeenAt: number | null;
};

function paid(o: Outcome): boolean {
  return o === "granted";
}

export function healthFor(faucetId: string, events: Event[], now = Date.now()): Health {
  const cutoff = now - HEALTH_WINDOW_MS;
  const mine = events.filter((e) => e.faucetId === faucetId && e.at >= cutoff);

  const granted = mine.filter((e) => paid(e.outcome));
  const lastGrantedAt = granted.length ? Math.max(...granted.map((e) => e.at)) : null;
  const lastSeenAt = mine.length ? Math.max(...mine.map((e) => e.at)) : null;

  if (mine.length < MIN_SAMPLE) {
    return { status: "unknown", successRate: null, sample: mine.length, lastGrantedAt, lastSeenAt };
  }

  const rate = granted.length / mine.length;
  const status: Status = rate >= 0.6 ? "flowing" : rate > 0 ? "patchy" : "dry";

  return { status, successRate: rate, sample: mine.length, lastGrantedAt, lastSeenAt };
}

/** Plain-language summary for the dashboard header. */
export function describe(h: Health): string {
  switch (h.status) {
    case "flowing":
      return "paying out";
    case "patchy":
      return "paying out sometimes";
    case "dry":
      return "refusing everyone";
    case "unknown":
      return "not enough reports yet";
  }
}
