import { test } from "node:test";
import assert from "node:assert/strict";
import { schedulerHealth, SCHEDULER_FLOOR_MS, STALE_AFTER_MS } from "../health.ts";
import { PROBE_INTERVAL_MS } from "../faucets.ts";

const H = 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

test("a board that has never probed is not accused of being broken", () => {
  const s = schedulerHealth(null, PROBE_INTERVAL_MS, NOW);
  assert.equal(s.healthy, true);
  assert.equal(s.dueAt, null);
  assert.equal(s.overdueByMs, 0);
});

test("inside the window nothing is owed", () => {
  const s = schedulerHealth(NOW - 4 * H, PROBE_INTERVAL_MS, NOW);
  assert.equal(s.overdueByMs, 0);
  assert.equal(s.healthy, true);
  assert.equal(s.dueAt, NOW - 4 * H + PROBE_INTERVAL_MS);
});

test("past the cadence it reports how late, but not yet a fault", () => {
  // Eleven hours is the ordinary case: GitHub dropped a few runs. The daily
  // Vercel cron has not had its turn yet, so nothing is actually broken.
  const s = schedulerHealth(NOW - 11 * H, PROBE_INTERVAL_MS, NOW);
  assert.equal(s.overdueByMs, 11 * H - PROBE_INTERVAL_MS);
  assert.equal(s.healthy, true);
});

test("past the daily floor both schedulers have failed", () => {
  const s = schedulerHealth(NOW - 27 * H, PROBE_INTERVAL_MS, NOW);
  assert.equal(s.healthy, false);
  assert.ok(s.overdueByMs > 0);
});

test("the floor flips exactly one millisecond past it", () => {
  assert.equal(schedulerHealth(NOW - SCHEDULER_FLOOR_MS, PROBE_INTERVAL_MS, NOW).healthy, true);
  assert.equal(schedulerHealth(NOW - SCHEDULER_FLOOR_MS - 1, PROBE_INTERVAL_MS, NOW).healthy, false);
});

test("the floor sits above the daily fallback, or it would fire on a healthy board", () => {
  // vercel.json runs the probe once a day. If the floor were tighter than that
  // plus slack, a deployment whose only working scheduler is the daily one
  // would be permanently reported as broken.
  assert.ok(SCHEDULER_FLOOR_MS > 24 * H, "floor must clear the daily cron");
  assert.ok(SCHEDULER_FLOOR_MS <= 30 * H, "a floor this loose stops meaning anything");
});

test("the fault signal outlasts the staleness signal", () => {
  // Data goes stale first and the board says "unknown"; only later does it
  // accuse the scheduler. Reversing these would blame the plumbing for what is
  // merely a quiet afternoon.
  assert.ok(SCHEDULER_FLOOR_MS > STALE_AFTER_MS);
});

test("overdue never goes negative", () => {
  for (const ago of [0, 1, H, PROBE_INTERVAL_MS - 1]) {
    assert.equal(schedulerHealth(NOW - ago, PROBE_INTERVAL_MS, NOW).overdueByMs, 0);
  }
});
