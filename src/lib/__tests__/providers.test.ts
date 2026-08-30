import test from "node:test";
import assert from "node:assert/strict";
import { FAUCETS, byId, endpointFor, isProbeConfigured, probeable } from "../faucets.ts";

const rpc = byId("solana-rpc-airdrop")!;
const helius = byId("helius-devnet")!;

test("a keyed provider is not probed at all when its key is absent", () => {
  assert.equal(endpointFor(helius, {}), null);
  assert.equal(isProbeConfigured(helius, {}), false);
});

test("a missing key never falls back to the shared endpoint", () => {
  // The failure mode this guards against: one provider's outage silently
  // spending the common endpoint's quota under a second faucet's name, so the
  // board reports two independent observations that were really one.
  const url = endpointFor(helius, { SOLANA_RPC_URL: "https://api.devnet.solana.com" });
  assert.equal(url, null);
});

test("a configured provider is called at its own endpoint, carrying its own key", () => {
  const url = endpointFor(helius, { HELIUS_API_KEY: "abc123" });
  assert.ok(url && url.includes("helius"), "must not be the shared devnet RPC");
  assert.ok(url && url.includes("abc123"), "the key travels with the request");
});

test("a key with URL-hostile characters is escaped, not pasted raw", () => {
  const url = endpointFor(helius, { HELIUS_API_KEY: "a b&c=d" })!;
  assert.ok(!url.includes("a b&c=d"), "raw key would break the query string");
  assert.ok(url.includes(encodeURIComponent("a b&c=d")));
});

test("the keyless faucet still uses the shared endpoint", () => {
  assert.equal(endpointFor(rpc, {}), "https://api.devnet.solana.com");
  assert.equal(
    endpointFor(rpc, { SOLANA_RPC_URL: "https://example.test" }),
    "https://example.test",
  );
});

test("every keyed faucet declares both a template and the variable holding the key", () => {
  for (const f of FAUCETS) {
    if (f.rpcTemplate) {
      assert.ok(f.keyEnv, `${f.id} has an endpoint template but no key variable`);
      assert.ok(f.rpcTemplate.includes("KEY"), `${f.id} has nowhere to put the key`);
    }
  }
});

test("no two faucets share a key variable", () => {
  // Sharing one would mean a single quota counted twice, which is the exact
  // dishonesty this whole arrangement exists to avoid.
  const envs = FAUCETS.map((f) => f.keyEnv).filter(Boolean);
  assert.equal(new Set(envs).size, envs.length);
});

test("providers are metered per account, so they are additive rather than a disguise", () => {
  for (const f of probeable()) {
    if (!f.keyEnv) continue;
    assert.notEqual(
      f.meters,
      "egress-ip",
      `${f.id} meters on IP, so a second key buys nothing and claiming otherwise would be a lie`,
    );
  }
});
