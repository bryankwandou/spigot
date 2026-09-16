import test from "node:test";
import assert from "node:assert/strict";
import { runLadder, type Ask } from "../probe.ts";
import { byId, askLadder } from "../faucets.ts";
import type { Outcome } from "../store.ts";

const rpc = byId("solana-rpc-airdrop")!;
const helius = byId("helius-devnet")!;
const FAR = Number.MAX_SAFE_INTEGER;

/** An upstream that answers from a script, and remembers what it was asked. */
function upstream(answers: Array<[Outcome, string | null]>) {
  const seen: number[] = [];
  let i = 0;
  const ask: Ask = async (sol) => {
    seen.push(sol);
    const [outcome, detail] = answers[Math.min(i++, answers.length - 1)];
    return { outcome, detail };
  };
  return { ask, seen };
}

test("a probe that never got a question out reports nothing", () => {
  // This is the bug that put a row reading "failed" into the log for a faucet
  // that was never contacted, and then set its cooldown from that invented
  // refusal. The log's only worth is that it is not invented.
  const u = upstream([["dry", "should never be reached"]]);
  return runLadder(rpc, u.ask, 0, () => 1).then((r) => {
    assert.equal(r.asked, false);
    assert.deepEqual(u.seen, [], "nothing was asked");
    assert.deepEqual(r.tried, []);
  });
});

test("a grant stops the ladder where it stands", async () => {
  const u = upstream([["granted", "sig"]]);
  const r = await runLadder(rpc, u.ask, FAR);
  assert.equal(r.asked, true);
  assert.equal(r.outcome, "granted");
  assert.deepEqual(u.seen, [rpc.expectedSol], "the published size paid, so no smaller ask");
});

test("a dry pool is asked again for less, all the way down", async () => {
  const u = upstream([["dry", "run dry"]]);
  const r = await runLadder(rpc, u.ask, FAR);
  assert.deepEqual(u.seen, askLadder(rpc), "every rung was tried");
  assert.equal(r.outcome, "dry");
  assert.equal(r.asked, true);
});

test("a thin pool pays the smaller ask the fixed one could never find", async () => {
  // Two SOL refused, a tenth granted -- the exact case a single fixed ask
  // reported as a dead faucet for twenty-two attempts in a row.
  const u = upstream([
    ["dry", "run dry"],
    ["dry", "run dry"],
    ["dry", "run dry"],
    ["dry", "run dry"],
    ["granted", "sig"],
  ]);
  const r = await runLadder(rpc, u.ask, FAR);
  assert.equal(r.outcome, "granted");
  assert.equal(u.seen.at(-1), 0.1);
});

test("a transient failure is retried once at the same size before dropping", async () => {
  const u = upstream([
    ["failed", "socket hang up"],
    ["granted", "sig"],
  ]);
  const r = await runLadder(rpc, u.ask, FAR);
  assert.deepEqual(u.seen, [rpc.expectedSol, rpc.expectedSol], "same size, twice");
  assert.equal(r.outcome, "granted");
});

test("a spent SOL allowance gets exactly one smaller ask, never a cascade", async () => {
  const u = upstream([["rate_limited", "limit of 1 SOL per project per day"]]);
  const r = await runLadder(helius, u.ask, FAR);
  assert.deepEqual(u.seen, [helius.expectedSol, 0.1], "the full figure, then the smallest slice");
  assert.equal(r.asked, true);
  assert.notEqual(u.seen.length, askLadder(helius).length + 1, "not the whole ladder");
});

test("a quota measured in requests is not haggled with at all", async () => {
  // The RPC airdrop meters on egress and says nothing about a SOL allowance.
  // Asking again in a smaller voice there is just hammering.
  const u = upstream([["rate_limited", "quota exceeded"]]);
  await runLadder(rpc, u.ask, FAR);
  assert.deepEqual(u.seen, [rpc.expectedSol], "asked once, then stopped");
});

test("the deadline stops the ladder without discarding what was learned", async () => {
  let clock = 0;
  const u = upstream([["dry", "run dry"]]);
  const r = await runLadder(rpc, u.ask, 10, () => (clock += 6));
  assert.equal(r.asked, true, "the first rung got through");
  assert.equal(r.outcome, "dry", "and its answer is kept");
  assert.equal(u.seen.length, 1, "but the ladder stopped there");
});
