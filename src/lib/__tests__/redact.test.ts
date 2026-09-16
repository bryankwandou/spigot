import test from "node:test";
import assert from "node:assert/strict";
import { redact } from "../redact.ts";

test("a key in the failing URL never reaches the public log", () => {
  // The board publishes what the upstream said, and what the upstream says
  // includes the URL it was called on. One of those URLs carries our key.
  const said = redact(
    "fetch failed: https://devnet.helius-rpc.com/?api-key=8f3c1d20-4b7a-4e19-9a6c-2d5e8b1f0c44",
  );
  assert.ok(!said.includes("8f3c1d20"), "the key is gone");
  assert.ok(said.includes("api-key=REDACTED"));
  assert.ok(said.includes("devnet.helius-rpc.com"), "the host still identifies the provider");
});

test("a bare key standing on its own is caught too", () => {
  const said = redact("401 for project 8f3c1d20-4b7a-4e19-9a6c-2d5e8b1f0c44");
  assert.equal(said, "401 for project REDACTED");
});

test("the sentence that matters is left readable", () => {
  // Redaction that eats the refusal defeats the purpose: the text is evidence.
  const dry =
    "airdrop request failed: You've either reached your airdrop limit today or the airdrop faucet has run dry.";
  assert.equal(redact(dry), dry);
});
