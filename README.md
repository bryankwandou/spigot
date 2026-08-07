<p align="center">
  <img src="public/logo.svg" width="72" alt="Spigot" />
</p>

<h1 align="center">Spigot</h1>

<p align="center">Devnet SOL on tap.</p>

---

Funding a Solana devnet wallet means visiting four sites, solving three captchas, and remembering which one you used yesterday. Spigot does that bookkeeping once, in public, so you can paste an address and get back to work.

## How it works

A scheduled job wakes every thirty minutes and asks `/api/relay/tick` which faucets are due. The endpoint owns the clock, not the schedule — each faucet is checked against its own published cooldown plus a three-minute margin, and anything still inside its window is reported as skipped rather than attempted.

What arrives lands in one public devnet treasury. Developers take one SOL per request, up to five per address per day, and every payout is a signature you can look up on an explorer.

## What this does not do

Rotating wallets or egress addresses to slip past a rate limit is the obvious way to make the numbers bigger. It is also the reason a project like this would deserve to be shut down, so Spigot does not do it. One identity per faucet, published limits honoured, margin added rather than shaved.

The honest consequence, measured rather than assumed: the public devnet RPC airdrop meters by **egress IP, not by address**. Three freshly generated addresses with no transaction history were refused six times across three amounts, every one a 429 reading *"you've either reached your airdrop limit today or the airdrop faucet has run dry."*

So automated intake from shared hosting is not small. It is **zero**, and adding wallets does not move it — only a different IP would, which is the line this project does not cross. The two remaining faucets are gated by a human check on purpose. Spigot surfaces their timers and a person clicks.

That reframes what this repository is worth. The treasury is filled by hand and by returns; the software's contribution is knowing which faucet is ready for you right now, and not wasting your click on one that isn't.

Devnet only. These tokens have no value and are not meant to acquire any.

## Running it

```bash
npm install
cp .env.example .env.local   # fill it in
npm run dev
```

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Neon Postgres. Holds the attempt log and therefore the cooldown clock. |
| `SPIGOT_TREASURY_ADDRESS` | Public devnet address that receives and pays out. |
| `SPIGOT_TREASURY_SECRET` | 64 bytes as a JSON array. Generate fresh; never reuse a wallet that has held mainnet funds. |
| `RELAY_TOKEN` | Shared secret between the workflow and `/api/relay/tick`. |
| `SOLANA_RPC_URL` | Optional. Defaults to the public devnet endpoint. |

Tables are created on first call, so there is no separate migration step.

## Deploying

Push, import the repository into Vercel, and set the same variables there. Then add two repository secrets so the schedule can reach the deployment:

- `RELAY_URL` — the deployment origin, no trailing slash
- `RELAY_TOKEN` — the same value as the environment variable

The workflow in `.github/workflows/relay.yml` handles the rest. It runs on GitHub's free tier for public repositories.

## Endpoints

| Route | Method | Purpose |
|---|---|---|
| `/api/status` | GET | Treasury balance, per-faucet timers, recent attempts. Public. |
| `/api/claim` | POST | `{ "address": "..." }` → one SOL and a signature. |
| `/api/relay/tick` | POST | Bearer-authenticated. Called by the schedule. |

## Security

No key is ever read from a file inside this repository. `.gitignore` blocks `.env*`, `*.key`, `*keypair*.json`, and `wallet*.txt`. `/api/status` returns only data that is already public: an address, a balance, timestamps, and signatures.

If a treasury secret is ever pasted somewhere it should not be — a chat window, an issue, a screenshot — treat it as gone and rotate to a new keypair. Devnet makes that cheap, which is the one advantage of practising here.
