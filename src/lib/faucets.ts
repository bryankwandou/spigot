/**
 * Registry of upstream devnet faucets.
 *
 * Ground rules this file exists to enforce:
 *  - One identity per faucet. Spigot does not rotate wallets or egress
 *    addresses to get around a limit. The treasury is the only recipient.
 *  - `cooldownMs` mirrors the faucet's own published limit. `MARGIN_MS` is the
 *    extra delay added on top so clock drift never puts a request in early.
 *  - A faucet that answers 429 has its window pushed out from that moment
 *    rather than being retried in a tight loop.
 */

/** Extra delay added to every cooldown so we are never early. */
export const COOLDOWN_MARGIN_MS = 3 * 60 * 1000;

/** How the upstream is reached. Web faucets are gated by a human check. */
export type Access = "server" | "human";

export type Faucet = {
  id: string;
  label: string;
  chain: "solana-devnet";
  access: Access;
  /** Published limit between requests for a single recipient. */
  cooldownMs: number;
  /** Typical grant, in SOL. */
  expectedSol: number;
  /** Public docs for the limit, so the number above is auditable. */
  terms: string;
  /** Needs an env-supplied key; skipped entirely when that key is absent. */
  requiresKey?: string;
};

export const FAUCETS: Faucet[] = [
  {
    id: "solana-rpc-airdrop",
    label: "Solana devnet RPC airdrop",
    chain: "solana-devnet",
    access: "server",
    cooldownMs: 8 * 60 * 60 * 1000,
    expectedSol: 2,
    terms: "https://solana.com/docs/rpc/http/requestairdrop",
  },
  {
    id: "solana-official-web",
    label: "faucet.solana.com",
    chain: "solana-devnet",
    access: "human",
    cooldownMs: 24 * 60 * 60 * 1000,
    expectedSol: 5,
    terms: "https://faucet.solana.com",
  },
  {
    id: "quicknode-web",
    label: "QuickNode devnet faucet",
    chain: "solana-devnet",
    access: "human",
    cooldownMs: 24 * 60 * 60 * 1000,
    expectedSol: 1,
    terms: "https://faucet.quicknode.com/solana/devnet",
  },
];

/** Earliest permissible next attempt, given the last attempt timestamp. */
export function nextEligibleAt(f: Faucet, lastAttemptMs: number | null): number {
  if (lastAttemptMs === null) return 0;
  return lastAttemptMs + f.cooldownMs + COOLDOWN_MARGIN_MS;
}

export function isEligible(f: Faucet, lastAttemptMs: number | null, now = Date.now()): boolean {
  return now >= nextEligibleAt(f, lastAttemptMs);
}

/** Faucets a scheduled job can actually call, given configured keys. */
export function serverCallable(): Faucet[] {
  return FAUCETS.filter(
    (f) => f.access === "server" && (!f.requiresKey || Boolean(process.env[f.requiresKey])),
  );
}

export function byId(id: string): Faucet | undefined {
  return FAUCETS.find((f) => f.id === id);
}
