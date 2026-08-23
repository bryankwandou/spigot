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
2. **A hosted service cannot fill a pool.** Vercel and GitHub Actions run on shared egress that thousands of others have already spent. Automated intake from there is zero.

That second point is why Spigot hands out nothing. An earlier draft of this app carried a treasury someone had to top up by hand, which is not a product — it is a favour with a deploy pipeline attached. What survives the measurement is the part that scales: the observation itself.

## What it does

| | |
|---|---|
| **Says what happened last** | Per faucet: paid, refused, or nothing seen — from Spigot's own probe plus reports from developers who clicked through. |
| **Shows the age of that answer** | Every verdict carries a timestamp. Past ten hours it stops claiming to be current and reads `unknown`. |
| **Keeps your own clock** | When *you* are next eligible, per faucet, in your browser. A faucet can be flowing and still closed to you — different question, shown separately. |

## The nine-hour cadence, and why the board admits it

The probe asks each server-reachable faucet once every nine hours: the tightest interval the upstream's own eight-hour limit permits with the three-minute margin on top. One address, one host, no rotation.

A board fed that slowly cannot answer "is it paying this second", so it does not pretend to. It answers what it can support — what happened the last time anyone looked, and how long ago that was — and prints the age beside the verdict so the reader can discount it. Anything older than ten hours is reported as `unknown` rather than as fact.

Reports are what tighten this. The probe guarantees a floor of one observation per window; an afternoon of people clicking through and saying what happened can push the freshest data point to minutes old, and the same code reads better the moment it does.

The schedule wakes every thirty minutes and is usually told "not yet". The nine-hour interval is enforced in `src/lib/faucets.ts`, not in the cron, because a cron pinned to nine hours drifts under GitHub's scheduler and eventually fires early — into a cooldown.

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

Tables are created on first call, so there is no separate migration step. The board degrades to `unknown` rather than erroring when `DATABASE_URL` is absent.

## Checks

```bash
npm run typecheck
npm test
```

Twenty-four tests over `health.ts` and `faucets.ts` — the two modules that decide what the board is allowed to say. They run on every push via `.github/workflows/check.yml`.

They pin boundaries rather than outputs, because every way this arithmetic breaks is quiet. A window narrowed below two probes, a staleness threshold that slips under the probe interval, a cooldown that loses its margin: none of those show a symptom. The board keeps rendering and starts asserting things the data cannot support.

Node's built-in runner executes the TypeScript directly, so the suite adds no dependency.

## Endpoints

| Route | Method | Purpose |
|---|---|---|
| `/api/status` | GET | The board. Add `?address=` for a personal clock. Public, writes nothing. |
| `/api/report` | POST | `{ faucetId, address, outcome }` — what happened when you clicked through. |
| `/api/relay/tick` | POST | Bearer-authenticated. The scheduled probe. |

## Deploying

Push, import into Vercel, set the variables there. Then add two repository secrets so the schedule can reach the deployment:

- `RELAY_URL` — the deployment origin, no trailing slash
- `RELAY_TOKEN` — the same value as the environment variable

`.github/workflows/relay.yml` handles the rest, on GitHub's free tier for public repositories.

## Security

There is no wallet in this deployment. The probe generates a throwaway keypair in memory, uses it once, and discards it — nothing it receives is ever spent or swept, and no code path reads a key from disk or from the environment. `.gitignore` blocks `.env*`, `*.key`, `*keypair*.json`, and `wallet*.txt` regardless, as a second line of defence.

Every field `/api/status` returns is already public: a faucet id, timestamps, and outcome counts.
