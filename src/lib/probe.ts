import type { Outcome } from "./store.ts";
import { type Faucet, askLadder, retriesSmallerAfterQuota } from "./faucets.ts";

/** One request to an upstream, already classified. */
export type Ask = (sol: number) => Promise<{ outcome: Outcome; detail: string | null }>;

/**
 * The result of working through one faucet's ladder.
 *
 * `asked` is the field that matters. False means the ladder never got a
 * question out — out of clock, nothing more — and the caller must not write a
 * row. A probe log whose rows include answers nobody gave is worse than no log
 * at all: it is the one artefact here that is supposed to be checkable, and it
 * also drives the cooldown clock, so an invented refusal buys a real wait.
 */
export type LadderResult = {
  asked: boolean;
  outcome: Outcome;
  detail: string | null;
  /** Sizes actually requested, in order. Useful for tests and for the record. */
  tried: number[];
};

/**
 * Ask a faucet for what it publishes, then for less, until something pays.
 *
 * The rungs exist because devnet answers a too-large ask with the same
 * "run dry" sentence it uses when it has nothing at all, so a single fixed ask
 * cannot tell a thin pool from an empty one and reads both as dead.
 *
 * Stopping rules, in the order they apply:
 *  - A grant ends it. There is nothing better to find.
 *  - A transient failure is retried once at the same size, then the ladder
 *    moves down. A connection that fell over is not a refusal.
 *  - A quota refusal ends it, except where the allowance is published in SOL
 *    rather than in requests: our opening ask is that whole figure, so any of
 *    it already spent refuses the request outright, and one smaller ask is a
 *    genuinely different question. See `retriesSmallerAfterQuota`.
 *  - The deadline ends it, and if it ends it before the first ask then nothing
 *    is reported at all.
 */
export async function runLadder(
  f: Faucet,
  ask: Ask,
  deadlineAt: number,
  now: () => number = Date.now,
): Promise<LadderResult> {
  const tried: number[] = [];
  let outcome: Outcome = "failed";
  let detail: string | null = null;
  let quotaRetried = false;

  for (const sol of askLadder(f)) {
    if (now() > deadlineAt) break;

    tried.push(sol);
    let a = await ask(sol);
    if (a.outcome === "failed") a = await ask(sol);
    outcome = a.outcome;
    detail = a.detail;

    if (outcome === "granted") break;

    if (outcome === "rate_limited") {
      if (!retriesSmallerAfterQuota(f) || quotaRetried) break;
      quotaRetried = true;
      const smallest = askLadder(f).at(-1)!;
      if (smallest === sol) break;
      tried.push(smallest);
      const again = await ask(smallest);
      outcome = again.outcome;
      detail = again.detail;
      break;
    }
  }

  return { asked: tried.length > 0, outcome, detail, tried };
}
