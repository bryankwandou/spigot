import test from "node:test";
import assert from "node:assert/strict";
import {
  byId,
  nextProbeAt,
  isProbeDue,
  probeIntervalFor,
  COOLDOWN_MARGIN_MS,
  PROBE_INTERVAL_MS,
  RETRY_INTERVAL_MS,
} from "../faucets.ts";

const NOW = 1_700_000_000_000;
const HOUR = 60 * 60 * 1000;
const rpc = byId("solana-rpc-airdrop")!;

test("a faucet never asked is due immediately", () => {
  assert.equal(nextProbeAt(rpc, null), 0);
  assert.equal(isProbeDue(rpc, null, NOW), true);
});

test("a grant buys the upstream its full published cooldown", () => {
  assert.equal(
    nextProbeAt(rpc, { at: NOW, outcome: "granted" }),
    NOW + rpc.cooldownMs + COOLDOWN_MARGIN_MS,
  );
  assert.equal(probeIntervalFor(rpc, "granted"), PROBE_INTERVAL_MS);
});

test("a refusal buys it an hour, because it dispensed nothing", () => {
  for (const outcome of ["dry", "rate_limited", "failed"] as const) {
    assert.equal(
      nextProbeAt(rpc, { at: NOW, outcome }),
      NOW + RETRY_INTERVAL_MS,
      `${outcome} should retry on the short clock`,
    );
  }
});

test("retrying after a refusal is strictly faster than after a grant", () => {
  assert.ok(
    RETRY_INTERVAL_MS < PROBE_INTERVAL_MS,
    "the whole point is that a refusal costs less waiting than a grant",
  );
});

test("the retry never goes below an hour, however impatient we get", () => {
  assert.ok(
    RETRY_INTERVAL_MS >= HOUR,
    "below an hour the courtesy is gone and a rate limiter may read it as abuse",
  );
});

test("a dry spell is rechecked at least eight times per published window", () => {
  assert.ok(
    Math.floor(PROBE_INTERVAL_MS / RETRY_INTERVAL_MS) >= 8,
    "the recovery window has to be caught, not slept through",
  );
});

test("the boundary flips exactly on the mark, not before", () => {
  const due = nextProbeAt(rpc, { at: NOW, outcome: "dry" });
  assert.equal(isProbeDue(rpc, { at: NOW, outcome: "dry" }, due - 1), false);
  assert.equal(isProbeDue(rpc, { at: NOW, outcome: "dry" }, due), true);
});

test("a grant is still honoured to the minute after a run of refusals", () => {
  // The impatient path must not leak into the one case where a real limit
  // applies, or the courtesy the whole design rests on is gone.
  const afterDry = nextProbeAt(rpc, { at: NOW, outcome: "dry" });
  const afterGrant = nextProbeAt(rpc, { at: afterDry, outcome: "granted" });
  assert.equal(afterGrant - afterDry, rpc.cooldownMs + COOLDOWN_MARGIN_MS);
});

test("the schedulers wake at least as often as the retry clock asks", () => {
  // GitHub Actions is cron'd hourly. A retry interval shorter than the wake-up
  // would be a promise the deployment cannot keep.
  assert.ok(RETRY_INTERVAL_MS >= HOUR, "no faster than the hourly workflow can call");
});
