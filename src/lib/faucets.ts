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
  /**
   * RPC endpoint to call, when it is not the default devnet one.
   *
   * `KEY` is substituted from `keyEnv`. Several providers run their own devnet
   * airdrop with a quota attached to the key rather than to the caller's
   * address, which is the honest way to widen supply: each provider is used
   * once per its own published window, as itself, with nothing disguised.
   */
  rpcTemplate?: string;
  /**
   * Environment variable holding this provider's free-tier key.
   *
   * Absent from the environment means the faucet is simply not probed. A
   * missing key is a configuration gap, never a reason to fall back to the
   * shared endpoint and spend somebody else's quota.
   */
  keyEnv?: string;
  /**
   * Whether the published allowance is "per day" and resets on the calendar
   * rather than a rolling window from the last request.
   *
   * This matters more than it looks. Waiting a fixed day from each refusal
   * walks the probe forward: refused at 09:00 and we return at 09:03 tomorrow,
   * refused again and 09:06 the day after. The allowance meanwhile came back at
   * midnight and sat unspent for nine hours every single day, and the drift
   * only ever grows. A calendar quota deserves a calendar clock.
   */
  quotaResetsDaily?: boolean;
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
    id: "helius-devnet",
    label: "Helius devnet airdrop",
    chain: "solana-devnet",
    access: "server",
    meters: "account",
    // Conservative: the free tier publishes a small daily allowance per key and
    // the exact figure moves, so this waits a full day rather than guessing
    // tight and being refused for asking early.
    cooldownMs: 24 * 60 * 60 * 1000,
    expectedSol: 1,
    claimUrl: "https://dashboard.helius.dev",
    terms: "https://docs.helius.dev/rpc",
    note: "Own quota, tied to a free API key rather than to your IP. Needs HELIUS_API_KEY set.",
    rpcTemplate: "https://devnet.helius-rpc.com/?api-key=KEY",
    keyEnv: "HELIUS_API_KEY",
    quotaResetsDaily: true,
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
 * Two answers buy the upstream its full published cooldown, for opposite
 * reasons. A grant, because it paid and is owed the wait. And an explicit quota
 * refusal — "1 SOL per project per day" — because that names a limit that is
 * genuinely ours and genuinely spent; retrying it hourly is two dozen useless
 * requests against an allowance of one, which is the behaviour this project
 * exists to not do.
 *
 * Everything else bought the upstream nothing. A pool that ran dry took no
 * quota and started no clock, and it can refill at any moment, so the only wait
 * owed there is the one we impose on ourselves out of courtesy.
 */
export function probeIntervalFor(f: Faucet, outcome: Outcome | null): number {
  const spent = outcome === "granted" || outcome === "rate_limited";
  return spent ? f.cooldownMs + COOLDOWN_MARGIN_MS : RETRY_INTERVAL_MS;
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
  const rolling = last.at + probeIntervalFor(f, last.outcome);

  // A daily allowance that we really did spend comes back on the calendar, not
  // a day after we happened to ask. Returning at the reset instead of a rolling
  // day is both earlier and stable: without it the probe drifts a few minutes
  // later after every refusal and the fresh allowance goes unspent for however
  // many hours the drift has accumulated.
  //
  // The retry floor still applies. Refused at 23:50, the reset is ten minutes
  // away and asking then would be reading the upstream's clock more precisely
  // than we are entitled to, so the hour is waited out regardless.
  const spentDailyQuota = f.quotaResetsDaily && last.outcome === "rate_limited";
  if (!spentDailyQuota) return rolling;

  const reset = nextUtcMidnight(last.at) + COOLDOWN_MARGIN_MS;
  return Math.max(Math.min(rolling, reset), last.at + RETRY_INTERVAL_MS);
}

/** First instant of the next UTC day after `at`. Where daily quotas refill. */
function nextUtcMidnight(at: number): number {
  const d = new Date(at);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

/**
 * Sizes to ask for, largest first, when the published grant is refused.
 *
 * The airdrop is not a switch. A contested pool that cannot spare two SOL can
 * very often spare a tenth of one, and the RPC answers a too-large ask with the
 * same "faucet has run dry" sentence it uses when it has nothing at all — so a
 * single fixed ask reads a partial pool as a dead one and walks away. That is
 * the shape of the twenty-two consecutive refusals this project recorded while
 * asking for two SOL every time and never once asking for less.
 *
 * Smaller is still worth having. A tenth of a SOL is the smallest grant the
 * board hands out, so anything down to that figure turns into a real claim for
 * a real person rather than a rounding error.
 */
/**
 * Whether a quota refusal is worth one smaller ask before the window is given up.
 *
 * Normally it is not: "you have spent your allowance" is an answer about the
 * allowance, not about the amount, and asking again in a smaller voice is the
 * hammering the cooldown exists to prevent.
 *
 * A daily allowance denominated in SOL is the exception, and Helius states it
 * outright — "a limit of 1 SOL per project per day". Our opening ask is that
 * whole figure, so any part of it already spent refuses the request outright
 * and we walk away from an allowance that still had most of itself left. A
 * tenth of a SOL is a genuinely different question, and asking it once is one
 * extra request against a limit published in SOL rather than in requests.
 */
export function retriesSmallerAfterQuota(f: Faucet): boolean {
  return f.quotaResetsDaily === true;
}

export function askLadder(f: Faucet): number[] {
  return [f.expectedSol, 1, 0.5, 0.25, 0.1].filter(
    (sol, i, all) => sol <= f.expectedSol && all.indexOf(sol) === i,
  );
}

export function isProbeDue(f: Faucet, last: LastProbe | null, now = Date.now()): boolean {
  return now >= nextProbeAt(f, last);
}

/** Faucets the scheduled probe may call at all. */
export function probeable(): Faucet[] {
  return FAUCETS.filter((f) => f.access === "server");
}

/**
 * The endpoint to call for a faucet, or null when its key is not configured.
 *
 * Null is a real answer and the caller must respect it. Quietly falling back to
 * the shared devnet RPC would make one provider's outage look like another's,
 * and would spend the common endpoint's quota under a second faucet's name.
 */
export function endpointFor(f: Faucet, env: Record<string, string | undefined>): string | null {
  if (!f.rpcTemplate) return env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  if (!f.keyEnv) return null;
  const key = env[f.keyEnv];
  if (!key) return null;
  return f.rpcTemplate.replace("KEY", encodeURIComponent(key));
}

/** Whether this faucet is reachable at all with the current configuration. */
export function isProbeConfigured(f: Faucet, env: Record<string, string | undefined>): boolean {
  return endpointFor(f, env) !== null;
}

export function byId(id: string): Faucet | undefined {
  return FAUCETS.find((f) => f.id === id);
}
