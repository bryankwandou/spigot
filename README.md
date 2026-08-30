<p align="center">
  <img src="public/logo.svg" width="72" alt="Spigot" />
</p>

<h1 align="center">Spigot</h1>

<p align="center">Which devnet faucet paid last, and how long ago.</p>

---

Devnet faucets go dry without announcing it. You open four tabs, sign in to two of them, and find out the hard way — having spent a claim to learn that there was nothing to claim. Then the next developer does the same thing an hour later, and learns the same thing, and tells nobody.

Spigot is a place to put that one fact.

## The measurement this is built on

The premise was checked before the code was written, and it changed the code.

Three freshly generated addresses, no transaction history, six requests to the public devnet RPC airdrop across three amounts. Every one refused:

```
429  "You've either reached your airdrop limit today or the airdrop
      faucet has run dry. Please visit https://faucet.solana.com"
```

The addresses were new, so the meter is not on the recipient — it is on the **egress IP**. Two consequences follow, and both are load-bearing:

1. **Rotating wallets cannot work.** Not "should not" — cannot. The upstream is not counting wallets. Anyone selling you a multi-wallet devnet farmer is selling a loop that returns 429 in ten different fonts.
2. **A hosted service cannot fill a pool on demand.** Vercel and GitHub Actions run on shared egress that thousands of others have already spent, so most requests from there are refused before they are considered.

What that rules out is a dispenser: something you ask for SOL and it pays you now. What it does not rule out is patience. Devnet's airdrop is exhausted, not dead — it recovers, and a request placed every hour through the dry spell is present when it does, without anyone sitting and watching for the moment. The yield is honest rather than impressive, and it costs nothing to collect.

So Spigot does two things with one request. It sends whatever it collects to the treasury, and it writes down what the faucet answered either way. The second is the part that scales: thousands of developers discover a dry faucet every day and that knowledge dies in each of their terminals separately. The refusals are the product.

## Where the airdrops go

Every collected airdrop is sent to one devnet account:

```
AsrL4uc9Ct7rhCASJXMhCtAX3k76RgkSsoe3pZFsBdyM
```

That is a public key, printed here on purpose. Crediting an account needs no signature, so the schedule can fill this treasury while the deployment holds no key, signs nothing, and is structurally unable to move a lamport of what it collects. Spending happens offline, by whoever holds the seed phrase, on their own machine.

The asymmetry is the point. A service that could also spend would need a secret in its environment — and a secret in a serverless environment is a secret in every build log, every error report, and every future deploy. There is nothing here to leak.

The board reads the balance straight from devnet rather than adding up its own log, because a confirmed signature and an unchanged balance is exactly the sort of disagreement worth being able to see.

**Expect a modest yield, for a measured reason.** Most asks are refused; see below. The account fills when the upstream recovers, not on demand.

### Handing it back out

Whatever accumulates is available in six fixed sizes — 0.1, 0.25, 0.5, 1, 2 and 3 SOL — one per address every eight hours, the same window the faucet itself refills on. Handing out faster than the account fills would empty it in favour of whoever wrote the first loop, and fixed sizes stop any single request from taking the lot.

A small reserve is never spent. An account drained to exactly zero cannot pay the fee to send anything again and would need its own airdrop just to become usable.

`/api/status` reports `signerReady` separately from the balance. One flag for both would make a missing or mismatched key look exactly like an empty account, and the wrong problem would get investigated for a week.

### About the key

Dispensing means signing, and signing means this deployment holds a private key. That is a real line and it is worth saying why it was crossed here and not earlier.

The rule being followed is not *never hold a key*. It is *never hold a key whose loss costs anything*. This keypair was generated for this service alone, starting from an empty balance, and it exists on devnet only. Everything it will ever hold arrives free from a public faucet. If the environment leaked tomorrow the entire loss is some devnet SOL that anyone can request again.

What must never happen — and does not happen here — is reusing a wallet that also holds mainnet funds, or one whose seed phrase covers other chains. That is not a larger version of this risk; it is a different risk, and no amount of convenience justifies putting one in an environment where secrets reach build logs, error reports and every future deploy.

## What it does

| | |
|---|---|
| **Says what happened last** | Per faucet: paid, refused, or nothing seen — from Spigot's own probe plus reports from developers who clicked through. |
| **Shows the age of that answer** | Every verdict carries a timestamp. Past ten hours it stops claiming to be current and reads `unknown`. |
| **Keeps your own clock** | When *you* are next eligible, per faucet, in your browser. A faucet can be flowing and still closed to you — different question, shown separately. |

## The nine-hour cadence, and why the board admits it

The probe's wait depends on what it was last told, because a grant and a refusal are not the same event:

| Last answer | Next ask | Why |
| --- | --- | --- |
| `granted` | 8h 3m | The upstream's published limit, plus margin for clock drift. It paid real SOL; it is owed the full wait. |
| `dry` / `rate_limited` / `failed` | 1h | Nothing was dispensed, so no cooldown started. Waiting eight hours on a refusal means devnet can refill and drain again entirely between two of our asks. |

An hour is a floor, not a target. It is roughly twenty requests a day against an RPC that tolerates a hundred a second, it matches the cadence the scheduler already runs at, and it cuts the worst case for noticing a recovery from eight hours to one. Going below it buys minutes and spends the courtesy the whole design rests on.

One address, one host, no rotation.

### More sources, not more faces

One endpoint that is globally dry collects nothing, and the obvious escape — a
fresh IP, a VM, a clean browser — is refused here. It also does not work: the
devnet RPC was measured refusing from two entirely separate egress addresses,
minutes apart, alongside two further endpoints. What is exhausted is the pool,
not our share of it.

The legitimate way to widen supply is to ask more providers, each as itself:

| Source | Meters on | Grant | Window |
| --- | --- | --- | --- |
| Devnet RPC airdrop | Egress IP | 2 SOL | 8h 3m after a grant, 1h after a dry pool |
| Helius devnet | The API key | 1 SOL | 24h — its own published daily allowance |

Each is called at its own endpoint, on its own key, inside its own published
window. Nothing pretends to be a caller it is not. A provider whose key is unset
is simply not probed, and never falls back to the shared RPC — that would spend
the common endpoint's quota under a second faucet's name and report one
observation as two.

Two details here were bugs until a real key was tried against them. The probe
asked every faucet for a flat 2 SOL, and Helius refuses an oversized request
outright rather than trimming it, so a working source would have refused us
forever while reporting a rate limit that was really our own arithmetic. And the
retry clock treated `Rate limit exceeded — 1 SOL per project per day` as a dry
pool worth rechecking hourly, which is twenty-four requests against an allowance
of one. A quota that is explicitly ours is now waited out in full; only a dry
pool gets the short clock.

A board fed that slowly cannot answer "is it paying this second", so it does not pretend to. It answers what it can support — what happened the last time anyone looked, and how long ago that was — and prints the age beside the verdict so the reader can discount it. Anything older than ten hours is reported as `unknown` rather than as fact.

Reports are what tighten this. The probe guarantees a floor of one observation per window; an afternoon of people clicking through and saying what happened can push the freshest data point to minutes old, and the same code reads better the moment it does.

## Two schedulers, because one of them is allowed to not show up

The probe is called by GitHub Actions hourly *and* by Vercel's own scheduler once a day. That redundancy is not belt-and-braces caution — it is a repair for a measured failure.

An earlier version asked GitHub for a run every thirty minutes: forty-eight a day. It was granted five, spaced 2.4, 3.9, 10.4, 10.0 and 8.3 hours apart. GitHub silently drops scheduled runs when its queue is busy, and there is no error anywhere when it does. The board went twenty hours without an observation.

To its credit the board *said so* — it printed `unknown` and reported its own data as stale rather than passing off a day-old reading as current. But it could not say why, and "this faucet is quiet" and "our scheduler died" are different problems with different fixes.

Two changes follow from that:

- **A floor that does not skip.** `vercel.json` runs the probe daily. GitHub stays as the opportunistic half that tightens the cadence toward hourly whenever it does fire. Both call the same endpoint, the endpoint holds the clock, and whichever arrives early is told "not yet" — so running both costs nothing and cannot breach a cooldown.
- **A signal for the plumbing itself.** `/api/status` now returns a `scheduler` block: when the last probe landed, when the next is due, how late it is, and whether the gap has passed the daily floor. Past that point the fault is the deployment, not the faucet.

Both intervals are enforced in `src/lib/faucets.ts`, never in a cron. A cron pinned to the exact interval drifts under a late scheduler and eventually fires early — into a cooldown. The schedulers are allowed to be dumb and frequent; the clock decides.

## What it will not do

- **No farming.** One identity, one request per window, three minutes of margin on top of every published limit. A 429 pushes the next window out rather than starting a retry loop.
- **No money.** No token, no fee, no paid tier, nothing to connect a mainnet wallet to.
- **No key requests.** Spigot holds no funds and signs nothing. Pasting a public address is the whole interaction, and even that is optional.

Devnet only. These tokens are worth nothing and are meant to stay that way.

## Running it

```bash
npm install
cp .env.example .env.local   # fill it in
npm run dev
```

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Neon Postgres. Holds the probe log and the reports. |
| `RELAY_TOKEN` | Shared secret between the schedule and `/api/relay/tick`. |
| `SOLANA_RPC_URL` | Optional. Defaults to the public devnet endpoint. |
| `CRON_SECRET` | Set in Vercel. Its own scheduler sends this as a bearer token. |
| `TREASURY_ADDRESS` | Optional. Public key that collected airdrops are sent to. |
| `TREASURY_SECRET` | Devnet-only signing key, as a JSON byte array. Without it the dispenser stays closed and the rest of the board still works. Rejected if it does not match `TREASURY_ADDRESS`. |

Tables are created on first call, so there is no separate migration step. The board degrades to `unknown` rather than erroring when `DATABASE_URL` is absent.

## Checks

```bash
npm run typecheck
npm test
```

Forty tests over `health.ts`, `faucets.ts` and `treasury.ts` — the modules that decide what the board is allowed to say and what it is allowed to hand out. They run on every push via `.github/workflows/check.yml`.

They pin boundaries rather than outputs, because every way this arithmetic breaks is quiet. A window narrowed below two probes, a staleness threshold that slips under the probe interval, a cooldown that loses its margin: none of those show a symptom. The board keeps rendering and starts asserting things the data cannot support.

Node's built-in runner executes the TypeScript directly, so the suite adds no dependency.

## Endpoints

| Route | Method | Purpose |
|---|---|---|
| `/api/status` | GET | The board. Add `?address=` for a personal clock. Public, writes nothing. |
| `/api/report` | POST | `{ faucetId, address, outcome }` — what happened when you clicked through. |
| `/api/dispense` | POST | `{ address, sol }` — asks for a grant. One per address per window. |
| `/api/relay/tick` | POST, GET | Bearer-authenticated. The scheduled probe. GET exists because Vercel's scheduler issues one. |

## Deploying

Push, import into Vercel, set the variables there. Then add two repository secrets so the schedule can reach the deployment:

- `RELAY_URL` — the deployment origin, no trailing slash
- `RELAY_TOKEN` — the same value as the environment variable

`.github/workflows/relay.yml` handles the rest, on GitHub's free tier for public repositories.

## Security

There is no wallet in this deployment. The probe generates a throwaway keypair in memory, uses it once, and discards it — nothing it receives is ever spent or swept, and no code path reads a key from disk or from the environment. `.gitignore` blocks `.env*`, `*.key`, `*keypair*.json`, and `wallet*.txt` regardless, as a second line of defence.

Every field `/api/status` returns is already public: a faucet id, timestamps, and outcome counts.
