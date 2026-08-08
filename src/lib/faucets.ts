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

/** Earliest permissible next request, given the last one. */
export function nextEligibleAt(f: Faucet, lastAtMs: number | null): number {
  if (lastAtMs === null) return 0;
  return lastAtMs + f.cooldownMs + COOLDOWN_MARGIN_MS;
}

export function isEligible(f: Faucet, lastAtMs: number | null, now = Date.now()): boolean {
  return now >= nextEligibleAt(f, lastAtMs);
}

/** Faucets the scheduled probe may call at all. */
export function probeable(): Faucet[] {
  return FAUCETS.filter((f) => f.access === "server");
}

export function byId(id: string): Faucet | undefined {
  return FAUCETS.find((f) => f.id === id);
}
