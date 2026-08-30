import test from "node:test";
import assert from "node:assert/strict";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { capacityOf } from "../capacity.ts";
import { RESERVE_LAMPORTS, TIERS } from "../treasury.ts";
import { byId } from "../faucets.ts";

const rpc = byId("solana-rpc-airdrop")!;
const helius = byId("helius-devnet")!;
const sol = (n: number) => n * LAMPORTS_PER_SOL;

test("an empty account offers nothing at any tier", () => {
  const c = capacityOf(0, []);
  assert.equal(c.spendableSol, 0);
  assert.equal(c.maxGrants, 0);
  for (const t of c.grantsPerTier) assert.equal(t.grants, 0);
});

test("an unreadable balance is treated as empty, never as unlimited", () => {
  // The RPC failing must not read as a full treasury on the public board.
  const c = capacityOf(null, [rpc]);
  assert.equal(c.spendableSol, 0);
  assert.equal(c.maxGrants, 0);
});

test("the fee reserve is never counted as spendable", () => {
  const c = capacityOf(RESERVE_LAMPORTS, []);
  assert.equal(c.spendableSol, 0, "a balance that is only reserve can fund no grant");
  assert.equal(c.maxGrants, 0);
});

test("a balance below the reserve does not go negative", () => {
  const c = capacityOf(1, []);
  assert.ok(c.spendableSol >= 0);
  assert.equal(c.maxGrants, 0);
});

test("grants per tier divide the spendable balance, not the whole balance", () => {
  const c = capacityOf(sol(1) + RESERVE_LAMPORTS, []);
  const smallest = c.grantsPerTier.find((t) => t.sol === 0.1)!;
  assert.equal(smallest.grants, 10, "exactly one SOL is spendable, so ten tenths");
  assert.equal(c.maxGrants, 10);
});

test("a tier larger than the balance reports zero rather than a fraction", () => {
  const c = capacityOf(sol(0.5) + RESERVE_LAMPORTS, []);
  assert.equal(c.grantsPerTier.find((t) => t.sol === 3)!.grants, 0);
  assert.equal(c.grantsPerTier.find((t) => t.sol === 0.5)!.grants, 1);
});

test("tiers are listed largest first, so the headline number is the generous one", () => {
  const c = capacityOf(sol(10), []);
  const order = c.grantsPerTier.map((t) => t.sol);
  assert.deepEqual(order, [...TIERS].sort((a, b) => b - a));
});

test("daily inflow is the sum of what each reachable faucet publishes", () => {
  const c = capacityOf(0, [helius]);
  assert.equal(c.dailyCeilingSol, 1, "one SOL per day is exactly its published allowance");
});

test("a faucet on a shorter window contributes proportionally more", () => {
  const c = capacityOf(0, [rpc]);
  // Two SOL per eight-hour window is three windows a day.
  assert.ok(c.dailyCeilingSol > 5.9 && c.dailyCeilingSol < 6.1, `got ${c.dailyCeilingSol}`);
});

test("with nothing reachable there is no fill estimate rather than an infinite one", () => {
  const c = capacityOf(0, []);
  assert.equal(c.dailyCeilingSol, 0);
  assert.equal(c.daysToFillLargestTier, null);
});

test("an account already holding the largest tier needs no more days", () => {
  const c = capacityOf(sol(3) + RESERVE_LAMPORTS, [helius]);
  assert.equal(c.daysToFillLargestTier, 0);
});

test("the fill estimate counts only the shortfall, not the whole tier", () => {
  const c = capacityOf(sol(2) + RESERVE_LAMPORTS, [helius]);
  assert.equal(c.daysToFillLargestTier, 1, "one SOL short at one SOL a day");
});
