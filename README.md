<p align="center">
  <img src="public/logo.svg" width="72" alt="Spigot" />
</p>

<h1 align="center">Spigot</h1>

<p align="center">Which devnet faucet is actually paying, right now.</p>

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

So Spigot does not run a treasury and does not hand out SOL. It cannot, honestly, and neither can anything else that claims to.

## What it does instead

| | |
|---|---|
| **Live health** | Whether each faucet is paying *anyone* in the last 90 minutes, from pooled reports plus Spigot's own probe. |
| **Your clock** | When *you* are next eligible, per faucet, kept in your browser. A faucet can be flowing and still closed to you — different question, shown separately. |
| **One click out** | Straight to the faucet that will actually work, instead of four tabs. |

The health signal is the interesting part. The knowledge already exists and is generated hundreds of times an hour; it just evaporates in individual terminals. Pooling it costs the upstream faucets nothing and saves everyone else the trip.

## What it will not do

- **No farming.** One identity, one request per cooldown window, three minutes of margin on top of every published limit. A 429 pushes the next window out rather than starting a retry loop.
- **No money.** No token, no fee, no paid tier, nothing to connect a mainnet wallet to. Devnet SOL is given away free by the people who issue it; reselling it would be selling something that is not ours.
- **No custody.** Spigot never holds funds, never asks for a private key, never signs on your behalf.

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

No key is read from any file in this repository. `.gitignore` blocks `.env*`, `*.key`, `*keypair*.json`, and `wallet*.txt`. The probe generates a throwaway keypair in memory, uses it once, and discards it — nothing it receives is ever spent or swept.

Every field `/api/status` returns is already public: an address you typed, timestamps, and outcome counts.
