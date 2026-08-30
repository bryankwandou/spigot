import type { Outcome } from "./store";

/**
 * Registry of upstream devnet faucets.
 *
 * Spigot hands out nothing of its own. It keeps a clock and a health signal so
 * a developer spends one click instead of four, and it stays inside every limit
 * the upstreams publish:
 *
 *  - `cooldownMs` mirrors the faucet's own published limit. `COOLDOWN_MARGIN_MS`
 *    is added on top so clock drift never puts a request in early.
 *  - Probes run at most once per window, from one address, from one host. No
 *    wallet rotation, no egress rotation. A 429 pushes the window out rather
 *    than triggering a retry loop.
 *  - `meters` records what the upstream actually counts against. Measured, not
 *    assumed: the RPC airdrop refuses brand-new addresses from a used IP, so it
 *    meters on egress and no number of wallets changes that.
 */

/**
 * How long to wait after the faucet actually paid.
 *
 * Eight hours is the upstream's own published limit and three minutes is the
 * margin, so this is the tightest cadence that stays inside the rules with
 * clock drift accounted for. It is also the number the health signal is
 * calibrated against — widen it and the window in `health.ts` has to widen too.
 *
 * This applies to a grant and nothing else. See `RETRY_INTERVAL_MS`.
 */
export const PROBE_INTERVAL_MS = 8 * 60 * 60 * 1000 + 3 * 60 * 1000;

/**
 * How long to wait after the faucet refused.
 *
 * A refusal and a grant are not the same event, and treating them the same was
 * a real mistake. The eight-hour limit is what you owe the upstream once it has
 * paid you; being told "the faucet has run dry" costs it nothing and starts no
 * cooldown, because nothing was dispensed. Sleeping eight hours on that answer
 * means devnet can refill and drain again entirely between two of our asks.
 *
 * Devnet's airdrop is a contested pool that refills and is emptied in minutes,
 * so the interval here is really a bet on how long a recovery stays visible. An
 * hour is the shortest wait that is still unmistakably polite: it is twenty-odd
 * requests a day against an RPC that tolerates a hundred a second, it is the
 * cadence the scheduler already runs at, and it cuts the worst case for
 * noticing a recovery from eight hours to one.
 *
 * It does not go below an hour. Past that the gain is small, the courtesy is
 * gone, and the risk of being read as abuse by a rate limiter we do not control
 * is not worth a few minutes.
 */
export const RETRY_INTERVAL_MS = 60 * 60 * 1000;

/** Extra delay added to every cooldown so we are never early. */
export const COOLDOWN_MARGIN_MS = 3 * 60 * 1000;

/** How the upstream is reached. Web faucets are gated by a human check. */
export type Access = "server" | "human";

/** What the upstream counts a request against. */
export type Meter = "egress-ip" | "recipient" | "account";

export type Faucet = {
  id: string;
  label: string;
  chain: "solana-devnet";
  access: Access;
  meters: Meter;
  /** Published limit between requests. */
  cooldownMs: number;
  /** Typical grant, in SOL. */
  expectedSol: number;
  /** Where a person goes to claim. */
  claimUrl: string;
  /** Public docs for the limit, so the number above is auditable. */
  terms: string;
  /** One line on the catch, shown in the UI. */
  note: string;
};

export const FAUCETS: Faucet[] = [
  {
    id: "solana-rpc-airdrop",
    label: "Devnet RPC airdrop",
    chain: "solana-devnet",
    access: "server",
    meters: "egress-ip",
    cooldownMs: 8 * 60 * 60 * 1000,
    expectedSol: 2,
    claimUrl: "https://solana.com/docs/rpc/http/requestairdrop",
    terms: "https://solana.com/docs/rpc/http/requestairdrop",
    note: "Counts against your IP, not your wallet. Runs dry for hours at a time.",
  },
  {
    id: "solana-official-web",
    label: "faucet.solana.com",
    chain: "solana-devnet",
    access: "human",
    meters: "recipient",
    cooldownMs: 24 * 60 * 60 * 1000,
    expectedSol: 5,
    claimUrl: "https://faucet.solana.com",
    terms: "https://faucet.solana.com",
    note: "Largest single grant. Needs a GitHub sign-in and a human check.",
  },
  {
    id: "quicknode-web",
    label: "QuickNode devnet faucet",
    chain: "solana-devnet",
    access: "human",
    meters: "recipient",
    cooldownMs: 24 * 60 * 60 * 1000,
    expectedSol: 1,
    claimUrl: "https://faucet.quicknode.com/solana/devnet",
    terms: "https://faucet.quicknode.com/solana/devnet",
    note: "Wants a mainnet balance on the address before it will pay out.",
  },
];

/**
 * Earliest permissible next request, given the last one.
 *
 * Two limits apply and the later one wins: the faucet's own published cooldown
 * plus the margin, and our own cadence. This is what makes the schedule real
 * rather than intended — the schedulers wake far more often than this on
 * purpose, because a cron pinned to the exact interval drifts under a late
 * scheduler and eventually fires early, into a cooldown. Waking often and being
 * told "not yet" costs nothing; the clock lives here.
 */
export function nextEligibleAt(f: Faucet, lastAtMs: number | null): number {
  if (lastAtMs === null) return 0;
  return lastAtMs + Math.max(f.cooldownMs + COOLDOWN_MARGIN_MS, PROBE_INTERVAL_MS);
}

export function isEligible(f: Faucet, lastAtMs: number | null, now = Date.now()): boolean {
  return now >= nextEligibleAt(f, lastAtMs);
}

/** The last thing a probe saw, which decides how soon the next one may run. */
export type LastProbe = { at: number; outcome: Outcome };

/**
 * How long the probe waits, given what it was told last time.
 *
 * A grant buys the upstream its full published cooldown. Anything else — dry,
 * rate limited, or an outright error — bought it nothing, so the only wait owed
 * is the one we impose on ourselves out of courtesy.
 */
export function probeIntervalFor(f: Faucet, outcome: Outcome | null): number {
  return outcome === "granted" ? f.cooldownMs + COOLDOWN_MARGIN_MS : RETRY_INTERVAL_MS;
}

/**
 * Earliest permissible next probe.
 *
 * Distinct from `nextEligibleAt`, which is a person's clock against a faucet
 * they claimed from by hand and has no outcome attached to it. This one is the
 * scheduler's, and it is allowed to be impatient after a refusal precisely
 * because a refusal consumed no quota.
 */
export function nextProbeAt(f: Faucet, last: LastProbe | null): number {
  if (last === null) return 0;
  return last.at + probeIntervalFor(f, last.outcome);
}

export function isProbeDue(f: Faucet, last: LastProbe | null, now = Date.now()): boolean {
  return now >= nextProbeAt(f, last);
}

/** Faucets the scheduled probe may call at all. */
export function probeable(): Faucet[] {
  return FAUCETS.filter((f) => f.access === "server");
}

export function byId(id: string): Faucet | undefined {
  return FAUCETS.find((f) => f.id === id);
}
