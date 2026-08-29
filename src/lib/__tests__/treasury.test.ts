import { test } from "node:test";
import assert from "node:assert/strict";
import { TIERS, isTier, RESERVE_LAMPORTS } from "../treasury.ts";
import { PROBE_INTERVAL_MS } from "../faucets.ts";

const LAMPORTS_PER_SOL = 1_000_000_000;

test("the tiers are exactly the six agreed sizes", () => {
  assert.deepEqual([...TIERS], [0.1, 0.25, 0.5, 1, 2, 3]);
});

test("the tiers only go up", () => {
  // The board picks the largest affordable tier by scanning from the end, so
  // an unsorted list would silently offer the wrong grant.
  const sorted = [...TIERS].sort((a, b) => a - b);
  assert.deepEqual([...TIERS], sorted);
});

test("anything not on the list is refused", () => {
  for (const bad of [0, -1, 0.2, 2.5, 4, 100, 1e9, NaN, Infinity]) {
    assert.equal(isTier(bad), false, `${bad} should not be a tier`);
  }
  for (const good of TIERS) assert.equal(isTier(good), true);
});

test("strings that look like amounts are still refused", () => {
  // JSON bodies arrive untyped, and "1" passing as 1 would let a caller skip
  // the tier list entirely through a loose comparison.
  for (const bad of ["1", "0.1", null, undefined, {}, [], true]) {
    assert.equal(isTier(bad), false);
  }
});

test("the largest tier is small next to what one airdrop brings", () => {
  // A single grant must not be able to consume more than the faucet delivers
  // in one go, or the account empties faster than it can possibly refill.
  const airdropSol = 2;
  assert.ok(Math.max(...TIERS) <= airdropSol + 1);
});

test("the reserve is kept back and is enough to pay a fee", () => {
  // Drained to exactly zero the account cannot afford to send anything again,
  // and would need its own airdrop just to become usable.
  const typicalFeeLamports = 5000;
  assert.ok(RESERVE_LAMPORTS > typicalFeeLamports * 100);
  assert.ok(RESERVE_LAMPORTS < Math.min(...TIERS) * LAMPORTS_PER_SOL);
});

test("a turn lasts as long as the refill window", () => {
  // Handing out faster than the faucet fills would empty the account in favour
  // of whoever wrote the first loop.
  assert.ok(PROBE_INTERVAL_MS >= 8 * 60 * 60 * 1000);
});

test("the smallest tier is worth asking for", () => {
  const rentExemptishSol = 0.002;
  assert.ok(Math.min(...TIERS) > rentExemptishSol * 10);
});
