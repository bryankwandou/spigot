import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TIERS, RESERVE_LAMPORTS } from "./treasury.ts";
import type { Faucet } from "./faucets.ts";

/**
 * How much this thing can actually hand out, and how fast it refills.
 *
 * A balance on its own does not answer the question anyone arriving here has,
 * which is "will it pay me, and if not, when". Two numbers answer that: what is
 * spendable right now, and what comes in per day. Both are derived rather than
 * promised — the balance is read from the chain, and the inflow is the sum of
 * what each reachable faucet publishes as its own grant over its own window.
 *
 * The inflow figure is a ceiling and is labelled as one everywhere it is shown.
 * It is what the upstreams would give if every ask succeeded, and most do not.
 * Presenting it as an expectation would be the same dishonesty as a live ticker
 * fed by a probe that runs hourly.
 */

export type Capacity = {
  /** Balance minus the fee reserve, in SOL. Never negative. */
  spendableSol: number;
  /** Held back to pay transaction fees, in SOL. */
  reservedSol: number;
  /** Grants still available at each tier, largest tier first. */
  grantsPerTier: Array<{ sol: number; grants: number }>;
  /** Total grants left if everyone took the smallest tier. */
  maxGrants: number;
  /** Upper bound on daily inflow, in SOL, if every ask were granted. */
  dailyCeilingSol: number;
  /** Days of supply at the current inflow, or null when nothing flows in. */
  daysToFillLargestTier: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function capacityOf(lamports: number | null, reachable: Faucet[]): Capacity {
  const reservedSol = RESERVE_LAMPORTS / LAMPORTS_PER_SOL;
  const spendableLamports = Math.max(0, (lamports ?? 0) - RESERVE_LAMPORTS);
  const spendableSol = spendableLamports / LAMPORTS_PER_SOL;

  const grantsPerTier = [...TIERS]
    .sort((a, b) => b - a)
    .map((sol) => ({
      sol,
      grants: Math.floor(spendableLamports / (sol * LAMPORTS_PER_SOL)),
    }));

  const smallest = Math.min(...TIERS);
  const maxGrants = Math.floor(spendableLamports / (smallest * LAMPORTS_PER_SOL));

  // Each faucet contributes its published grant once per its published window.
  // A faucet that cannot be reached without a human contributes nothing here,
  // because this number has to describe what runs unattended.
  const dailyCeilingSol = reachable.reduce(
    (sum, f) => sum + f.expectedSol * (DAY_MS / f.cooldownMs),
    0,
  );

  const largest = Math.max(...TIERS);
  const shortfall = Math.max(0, largest - spendableSol);
  const daysToFillLargestTier =
    dailyCeilingSol <= 0 ? null : shortfall === 0 ? 0 : shortfall / dailyCeilingSol;

  return {
    spendableSol,
    reservedSol,
    grantsPerTier,
    maxGrants,
    dailyCeilingSol,
    daysToFillLargestTier,
  };
}
