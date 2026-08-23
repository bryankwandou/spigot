import { test } from "node:test";
import assert from "node:assert/strict";
import { healthFor, describe, HEALTH_WINDOW_MS, STALE_AFTER_MS } from "../health.ts";
import type { Event, Outcome } from "../store.ts";

/**
 * The calibration is the product. Every constant here was chosen against a
 * nine-hour probe cadence, and the failure mode if one drifts is silent: the
 * board keeps rendering, keeps looking maintained, and starts asserting things
 * it cannot support. These tests exist to make that drift loud.
 */

const NOW = 1_700_000_000_000;
const HOUR = 60 * 60 * 1000;

function ev(at: number, outcome: Outcome, faucetId = "f1"): Event {
  return { faucetId, at, outcome, source: "probe", detail: null };
}

test("says nothing when it has seen nothing", () => {
  const h = healthFor("f1", [], NOW);
  assert.equal(h.status, "unknown");
  assert.equal(h.sample, 0);
  assert.equal(h.lastSeenAt, null);
  assert.equal(h.lastOutcome, null);
  // Not stale: there is no observation to have gone stale. The distinction
  // matters because the copy differs, and "no recent check" on a board that
  // has never checked would be misleading.
  assert.equal(h.stale, false);
  assert.equal(describe(h), "nothing observed yet");
});

test("a fresh grant reads as flowing", () => {
  const h = healthFor("f1", [ev(NOW - HOUR, "granted")], NOW);
  assert.equal(h.status, "flowing");
  assert.equal(h.lastOutcome, "granted");
  assert.equal(h.stale, false);
});

test("a fresh refusal with nothing else reads as dry", () => {
  const h = healthFor("f1", [ev(NOW - HOUR, "dry")], NOW);
  assert.equal(h.status, "dry");
  assert.equal(describe(h), "refused on the last check");
});

test("one grant among refusals is patchy, not flowing", () => {
  // The freshest observation paid, but three of the four in the window did
  // not. Calling that "flowing" sends someone to a faucet that fails them
  // three times out of four.
  const events = [
    ev(NOW - HOUR, "granted"),
    ev(NOW - 3 * HOUR, "dry"),
    ev(NOW - 5 * HOUR, "dry"),
    ev(NOW - 7 * HOUR, "dry"),
  ];
  const h = healthFor("f1", events, NOW);
  assert.equal(h.status, "patchy");
  assert.equal(h.successRate, 0.25);
});

test("a refusal is patchy when the window still holds a grant", () => {
  const h = healthFor("f1", [ev(NOW - HOUR, "dry"), ev(NOW - 3 * HOUR, "granted")], NOW);
  assert.equal(h.status, "patchy");
  assert.equal(describe(h), "paying some of the time");
});

test("a mostly-successful window keeps a fresh grant at flowing", () => {
  const h = healthFor("f1", [ev(NOW - HOUR, "granted"), ev(NOW - 3 * HOUR, "granted")], NOW);
  assert.equal(h.status, "flowing");
  assert.equal(h.successRate, 1);
});

test("past the staleness threshold it stops claiming anything", () => {
  // Half-day-old evidence is history. Reporting it as a current verdict is how
  // a board sends someone to a dead page with confidence.
  const h = healthFor("f1", [ev(NOW - (STALE_AFTER_MS + HOUR), "dry")], NOW);
  assert.equal(h.status, "unknown");
  assert.equal(h.stale, true);
  // The observation is still returned so the interface can print its age.
  assert.equal(h.lastOutcome, "dry");
  assert.notEqual(h.lastSeenAt, null);
  assert.equal(describe(h), "no recent check");
});

test("an observation just inside the threshold still counts", () => {
  const h = healthFor("f1", [ev(NOW - (STALE_AFTER_MS - 1), "granted")], NOW);
  assert.equal(h.stale, false);
  assert.equal(h.status, "flowing");
});

test("the staleness threshold sits above the probe interval", () => {
  // A board merely waiting for its next nine-hourly probe must not read as
  // abandoned. If these ever cross, every row goes unknown between probes.
  assert.ok(STALE_AFTER_MS > 9 * HOUR, "stale threshold must exceed the probe interval");
  assert.ok(HEALTH_WINDOW_MS >= 2 * 9 * HOUR, "window must hold at least two probes");
});

test("observations older than the window are ignored entirely", () => {
  const events = [ev(NOW - (HEALTH_WINDOW_MS + HOUR), "granted")];
  const h = healthFor("f1", events, NOW);
  assert.equal(h.sample, 0);
  assert.equal(h.status, "unknown");
  assert.equal(h.stale, false);
});

test("another faucet's observations never leak in", () => {
  const h = healthFor("f1", [ev(NOW - HOUR, "granted", "f2")], NOW);
  assert.equal(h.sample, 0);
  assert.equal(h.status, "unknown");
});

test("a single observation yields no success rate", () => {
  // One data point is an anecdote. Publishing "100%" off it invites a trust
  // the board has not earned.
  const h = healthFor("f1", [ev(NOW - HOUR, "granted")], NOW);
  assert.equal(h.successRate, null);
  assert.equal(h.sample, 1);
});

test("lastGrantedAt survives a later refusal", () => {
  const grantedAt = NOW - 5 * HOUR;
  const h = healthFor("f1", [ev(NOW - HOUR, "dry"), ev(grantedAt, "granted")], NOW);
  assert.equal(h.lastGrantedAt, grantedAt);
  assert.equal(h.lastSeenAt, NOW - HOUR);
});

test("unsorted input still resolves the freshest observation", () => {
  const h = healthFor("f1", [ev(NOW - 5 * HOUR, "dry"), ev(NOW - HOUR, "granted")], NOW);
  assert.equal(h.lastOutcome, "granted");
  assert.equal(h.lastSeenAt, NOW - HOUR);
});

test("every status has copy and none of it leaks a label", () => {
  const cases: Event[][] = [
    [],
    [ev(NOW - HOUR, "granted")],
    [ev(NOW - HOUR, "dry")],
    [ev(NOW - HOUR, "dry"), ev(NOW - 3 * HOUR, "granted")],
    [ev(NOW - (STALE_AFTER_MS + HOUR), "dry")],
  ];
  for (const c of cases) {
    const line = describe(healthFor("f1", c, NOW));
    assert.ok(line.length > 0);
    assert.ok(!/unknown|patchy|flowing/.test(line), `raw status leaked into copy: ${line}`);
  }
});
