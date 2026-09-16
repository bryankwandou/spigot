import test from "node:test";
import assert from "node:assert/strict";
import {
  FAUCETS,
  byId,
  nextProbeAt,
  isProbeDue,
  probeIntervalFor,
  COOLDOWN_MARGIN_MS,
  PROBE_INTERVAL_MS,
  RETRY_INTERVAL_MS,
  askLadder,
  retriesSmallerAfterQuota,
} from "../faucets.ts";

const NOW = 1_700_000_000_000;
const HOUR = 60 * 60 * 1000;
const rpc = byId("solana-rpc-airdrop")!;
const helius = byId("helius-devnet")!;

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

test("a dry pool buys it an hour, because it dispensed nothing", () => {
  for (const outcome of ["dry", "failed"] as const) {
    assert.equal(
      nextProbeAt(rpc, { at: NOW, outcome }),
      NOW + RETRY_INTERVAL_MS,
      `${outcome} should retry on the short clock`,
    );
  }
});

test("a quota that is explicitly ours is waited out in full", () => {
  // "1 SOL per project per day" names a limit we really did spend. Retrying it
  // hourly would be two dozen useless asks against an allowance of one -- the
  // exact impoliteness the short clock must never be allowed to leak into.
  assert.equal(
    nextProbeAt(rpc, { at: NOW, outcome: "rate_limited" }),
    NOW + rpc.cooldownMs + COOLDOWN_MARGIN_MS,
  );
});

test("a daily quota is picked up again at the reset, not a day after we asked", () => {
  // Waiting a rolling day from each refusal walks the probe forward a few
  // minutes every time, and the allowance that came back at midnight sits
  // unspent for however many hours the drift has reached. Two years of that is
  // a faucet that is configured, funded and never once collected from.
  const at = Date.UTC(2026, 0, 10, 9, 0, 0);
  const due = nextProbeAt(helius, { at, outcome: "rate_limited" });

  assert.equal(due, Date.UTC(2026, 0, 11) + COOLDOWN_MARGIN_MS);
  assert.ok(due < at + helius.cooldownMs, "the reset comes before a rolling day");

  // And it does not drift: refused again just after the reset, the probe is
  // still aiming at a midnight rather than at a growing offset.
  const second = nextProbeAt(helius, { at: due, outcome: "rate_limited" });
  assert.equal(second, Date.UTC(2026, 0, 12) + COOLDOWN_MARGIN_MS);
});

test("a reset minutes away is still not asked for early", () => {
  // Being right about the reset hour is not the same as being entitled to hit
  // it to the minute. The hourly floor holds whatever the calendar says.
  const at = Date.UTC(2026, 0, 10, 23, 50, 0);
  assert.equal(nextProbeAt(helius, { at, outcome: "rate_limited" }), at + RETRY_INTERVAL_MS);
});

test("a refused ask is followed by a smaller one before the window is given up", () => {
  // The upstream answers "run dry" both when it has nothing and when it merely
  // cannot spare the size asked for, so one fixed ask reads a thin pool as a
  // dead one. Twenty-two consecutive refusals were recorded asking two SOL
  // every single time and never once asking for less.
  const ladder = askLadder(rpc);

  assert.equal(ladder[0], rpc.expectedSol, "the published grant is still asked for first");
  assert.deepEqual([...ladder].sort((a, b) => b - a), ladder, "only ever asks for less");
  assert.equal(new Set(ladder).size, ladder.length, "no size is asked for twice");
  assert.ok(ladder.length > 1, "a single-rung ladder is the bug this fixes");
  assert.equal(ladder.at(-1), 0.1, "the last rung is still a grant somebody can claim");

  // A provider that publishes one SOL is never asked for two: the greedy ask is
  // refused outright rather than trimmed, which made a working source look dead.
  assert.ok(Math.max(...askLadder(helius)) <= helius.expectedSol);
});

test("an allowance published in SOL gets one smaller ask, a plain quota gets none", () => {
  // Helius answers "a limit of 1 SOL per project per day" and our opening ask
  // is that entire figure, so any part of it already spent refuses the whole
  // request and we walk away from an allowance with most of itself left.
  assert.equal(retriesSmallerAfterQuota(helius), true);
  assert.ok(askLadder(helius).at(-1)! < helius.expectedSol, "there is a smaller rung to drop to");

  // The RPC airdrop meters on egress and says nothing about a SOL allowance.
  // Asking it again in a smaller voice is just hammering.
  assert.equal(retriesSmallerAfterQuota(rpc), false);
});

test("a provider is only ever asked for what it publishes", () => {
  // Asking two SOL of a faucet that allows one is refused outright, not
  // trimmed, so the greedy ask makes a working source look permanently broken.
  for (const f of FAUCETS) {
    assert.ok(f.expectedSol > 0, `${f.id} must declare what it grants`);
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
