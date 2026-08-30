import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FAUCETS,
  byId,
  probeable,
  isEligible,
  nextEligibleAt,
  COOLDOWN_MARGIN_MS,
  PROBE_INTERVAL_MS,
} from "../faucets.ts";

/**
 * The cooldown arithmetic is the part that can get the project banned from an
 * upstream. It is also the part with no visible symptom when it is wrong by a
 * few minutes — the requests simply start landing early and the 429s look like
 * ordinary dryness.
 */

const HOUR = 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

test("a faucet never asked is eligible immediately", () => {
  for (const f of FAUCETS) {
    assert.equal(nextEligibleAt(f, null), 0);
    assert.equal(isEligible(f, null, NOW), true);
  }
});

test("the published cooldown and the margin are exactly the cadence", () => {
  // The RPC airdrop publishes eight hours. Our own interval is longer, so it
  // is the one that binds — this is what makes the schedule real rather than
  // fact rather than only in the comment above the cron.
  const rpc = byId("solana-rpc-airdrop");
  assert.ok(rpc, "the RPC faucet must exist");
  // The RPC faucet publishes eight hours; the cadence is that plus the margin,
  // so for this faucet the two limits coincide and neither is slack.
  assert.equal(rpc.cooldownMs + COOLDOWN_MARGIN_MS, PROBE_INTERVAL_MS);
  assert.equal(nextEligibleAt(rpc, NOW), NOW + PROBE_INTERVAL_MS);
});

test("a longer upstream cooldown overrides our cadence", () => {
  // The web faucets publish a day. Nine hours must never shorten that.
  for (const f of FAUCETS.filter((x) => x.cooldownMs + COOLDOWN_MARGIN_MS > PROBE_INTERVAL_MS)) {
    assert.equal(nextEligibleAt(f, NOW), NOW + f.cooldownMs + COOLDOWN_MARGIN_MS);
  }
});

test("no faucet is ever asked before its published limit plus margin", () => {
  // The invariant that keeps us inside every upstream's terms.
  for (const f of FAUCETS) {
    const gap = nextEligibleAt(f, NOW) - NOW;
    assert.ok(
      gap >= f.cooldownMs + COOLDOWN_MARGIN_MS,
      `${f.id} would be asked ${(f.cooldownMs + COOLDOWN_MARGIN_MS - gap) / 1000}s early`,
    );
  }
});

test("eligibility flips exactly at the boundary, not before", () => {
  const rpc = byId("solana-rpc-airdrop")!;
  const ready = nextEligibleAt(rpc, NOW);
  assert.equal(isEligible(rpc, NOW, ready - 1), false);
  assert.equal(isEligible(rpc, NOW, ready), true);
});

test("the margin is real and positive", () => {
  assert.ok(COOLDOWN_MARGIN_MS > 0, "a zero margin puts every request on the boundary");
});

test("only server-reachable faucets are probed", () => {
  // The other two sit behind a human check. Probing them would either fail
  // permanently or require defeating that check, and the second is not
  // something this project does.
  // Asserted as a property rather than a fixed list: adding a provider that
  // publishes its own quota is expected and good, and a test that has to be
  // edited to allow it teaches people to edit tests.
  const probes = probeable();
  assert.ok(probes.length > 0, "something has to be reachable or the board never fills");
  for (const f of probes) assert.equal(f.access, "server");
  for (const f of FAUCETS.filter((x) => x.access === "human")) {
    assert.ok(!probes.includes(f), `${f.id} is behind a human check and must not be probed`);
  }
});

test("every faucet is internally coherent", () => {
  const seen = new Set<string>();
  for (const f of FAUCETS) {
    assert.ok(!seen.has(f.id), `duplicate faucet id ${f.id}`);
    seen.add(f.id);
    assert.ok(f.cooldownMs > 0, `${f.id} has no cooldown`);
    assert.ok(f.expectedSol > 0, `${f.id} claims to pay nothing`);
    assert.ok(f.note.length > 0, `${f.id} has no note on its catch`);
    // Both links are shown to a person, so both must be resolvable.
    for (const url of [f.claimUrl, f.terms]) {
      assert.ok(url.startsWith("https://"), `${f.id} has a non-https link: ${url}`);
    }
    assert.equal(f.chain, "solana-devnet", `${f.id} is not devnet`);
  }
});

test("byId refuses to invent a faucet", () => {
  assert.equal(byId("no-such-faucet"), undefined);
});

/**
 * A link a person can claim from, and a link that only documents a call.
 *
 * `claimUrl` carries both, and the board rendered both behind the same button
 * reading "Open faucet". For the two server rows that button led to the
 * requestAirdrop API reference and the Helius dashboard — a specification and a
 * signup page, neither of which hands anybody SOL. People clicked it, found no
 * claim form, and asked why the faucet was broken. It was not; the button was
 * pointing at the endpoint Spigot posts to on their behalf.
 *
 * The distinction is `access`, so hold the data to it: a row a person is invited
 * to open must point at somewhere they can actually claim.
 */
test("only the faucets a person can use point at a place to claim", () => {
  const CLAIMABLE = ["faucet.solana.com", "faucet.quicknode.com"];

  for (const f of FAUCETS) {
    const host = new URL(f.claimUrl).host;
    if (f.access === "human") {
      assert.ok(
        CLAIMABLE.includes(host),
        `${f.id} invites a person to open it, so ${host} must be somewhere they can claim`,
      );
    } else {
      assert.ok(
        !CLAIMABLE.includes(host),
        `${f.id} is called by the server; ${host} is a claim page and would read as one`,
      );
    }
  }
});

test("every faucet link is somewhere a browser can go", () => {
  for (const f of FAUCETS) {
    for (const [field, url] of [["claimUrl", f.claimUrl], ["terms", f.terms]] as const) {
      assert.doesNotThrow(() => new URL(url), `${f.id}.${field} is not a URL`);
      assert.equal(new URL(url).protocol, "https:", `${f.id}.${field} must be https`);
    }
  }
});
