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

So the pool is filled by hand and the app is honest about it. Someone claims from the human-gated faucets and forwards it to the treasury; per-address caps spread that across the developers who could not get through at all. Any project claiming an automated devnet pipeline is describing a loop that returns 429 in ten different fonts.

## What it does

| | |
|---|---|
| **Draw from the pool** | One SOL per request, five per address per day, straight to a devnet address you paste. Free. |
| **Live health** | Whether each faucet is paying *anyone* in the last 90 minutes, from pooled reports plus Spigot's own probe. |
| **Your clock** | When *you* are next eligible, per faucet, kept in your browser. A faucet can be flowing and still closed to you — different question, shown separately. |

The health signal is the part that scales past the pool. That knowledge is generated hundreds of times an hour and currently evaporates in individual terminals. Pooling it costs the upstream faucets nothing and saves everyone else the trip.

## What it will not do

- **No farming.** One identity, one request per cooldown window, three minutes of margin on top of every published limit. A 429 pushes the next window out rather than starting a retry loop.
- **No money.** No token, no fee, no paid tier, nothing to connect a mainnet wallet to. Devnet SOL is given away free by the people who issue it; reselling it would be selling something that is not ours.
- **No key requests.** The pool signs with its own wallet and sends outward only. Nothing asks you for a seed phrase, a private key, or a signature — pasting a public address is the whole interaction.

Devnet only. These tokens are worth nothing and are meant to stay that way.

## Running it

```bash
npm install
cp .env.example .env.local   # fill it in
npm run dev
```

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Neon Postgres. Holds the probe log, the reports, and the claim ledger. |
| `RELAY_TOKEN` | Shared secret between the schedule and `/api/relay/tick`. |
| `SPIGOT_TREASURY_ADDRESS` | Public devnet address of the pool. |
| `SPIGOT_TREASURY_SECRET` | The wallet's base58 export, or 64 bytes as a JSON array. Environment only — never a file path. |
| `SOLANA_RPC_URL` | Optional. Defaults to the public devnet endpoint. |

Tables are created on first call, so there is no separate migration step. The board degrades to `unknown` rather than erroring when `DATABASE_URL` is absent.

## Endpoints

| Route | Method | Purpose |
|---|---|---|
| `/api/claim` | POST | `{ address }` → one SOL from the pool and a signature. |
| `/api/status` | GET | The board. Add `?address=` for a personal clock. Public, writes nothing. |
| `/api/report` | POST | `{ faucetId, address, outcome }` — what happened when you clicked through. |
| `/api/relay/tick` | POST | Bearer-authenticated. The scheduled probe. |

## Deploying

Push, import into Vercel, set the variables there. Then add two repository secrets so the schedule can reach the deployment:

- `RELAY_URL` — the deployment origin, no trailing slash
- `RELAY_TOKEN` — the same value as the environment variable

`.github/workflows/relay.yml` handles the rest, on GitHub's free tier for public repositories.

## Security

The treasury secret enters through the environment and nowhere else. No code path reads a wallet file from disk, because a path inside a repository ends up deployed and readable. `.gitignore` blocks `.env*`, `*.key`, `*keypair*.json`, and `wallet*.txt` as a second line of defence.

`treasuryKeypair()` refuses to run if the secret and `SPIGOT_TREASURY_ADDRESS` disagree, so a deployment can never quietly sign with a wallet other than the one it publishes. A fee floor of 0.01 SOL is held back so the pool can always pay for its own transactions.

The probe generates a throwaway keypair in memory, uses it once, and discards it — nothing it receives is ever spent or swept.

Every field `/api/status` returns is already public: an address, a balance, timestamps, and outcome counts.

If a treasury secret is ever pasted somewhere it should not be — a chat window, an issue, a screenshot — treat it as gone and generate another. Devnet makes that free, which is the one advantage of learning this here.
