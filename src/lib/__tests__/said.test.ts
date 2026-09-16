import test from "node:test";
import assert from "node:assert/strict";
import { said } from "../said.ts";

test("the refusal is quoted without the envelope it arrived in", () => {
  // Verbatim from the production log, trailing carriage return and all.
  const raw =
    '429 Too Many Requests:  {"jsonrpc":"2.0","error":{"code": 429, "message":"You\'ve either reached your airdrop limit today or the airdrop faucet has run dry. Please visit https://faucet.solana.com for alternate sources of test SOL"}, "id": "9c1f2b70-5a3d-4e11-8b22-77a0c4e6d905" } \r';

  assert.equal(
    said(raw),
    "429 Too Many Requests: You've either reached your airdrop limit today or the airdrop faucet has run dry. Please visit https://faucet.solana.com for alternate sources of test SOL",
  );
});

test("the request id is gone, so nothing is left for the redactor to black out", () => {
  // It used to survive into the quote as `"id": "REDACTED"`, which reads like
  // the record was edited. It is dropped now because it was never part of what
  // the upstream said.
  const raw =
    '429 Too Many Requests: {"jsonrpc":"2.0","error":{"code":429,"message":"run dry"},"id":"9c1f2b70-5a3d-4e11-8b22-77a0c4e6d905"}';
  assert.equal(said(raw), "429 Too Many Requests: run dry");
  assert.ok(!said(raw).includes("REDACTED"));
});

test("the status is kept, because which refusal it was is the whole point", () => {
  const quota =
    '403 Forbidden: {"jsonrpc":"2.0","error":{"code":-32403,"message":"Rate limit exceeded. The devnet faucet has a limit of 1 SOL per project per day. Please try again later."}}';
  const out = said(quota);
  assert.ok(out.startsWith("403 Forbidden:"), "a spent allowance is not a dry pool");
  assert.ok(out.includes("1 SOL per project per day"));
});

test("a key inside the envelope is still stripped", () => {
  const leak =
    '401 Unauthorized: {"error":{"message":"bad key for https://devnet.helius-rpc.com/?api-key=8f3c1d20-4b7a-4e19-9a6c-2d5e8b1f0c44"}}';
  const out = said(leak);
  assert.ok(!out.includes("8f3c1d20"));
  assert.ok(out.includes("api-key=REDACTED"));
});

test("text that is not an envelope is passed through, not thrown away", () => {
  // The unanticipated message is the one most worth reading.
  assert.equal(said("fetch failed"), "fetch failed");
  assert.equal(said("  socket hang up\n"), "socket hang up");
});

test("an envelope with an empty message falls back to the raw text", () => {
  const empty = '500: {"error":{"message":""}}';
  assert.ok(said(empty).includes("500"));
});
