# Spigot — Brand

## The name
A spigot is the tap at the end of a pipe. Turn it, water comes out, turn it off. That is the product in one object: nobody should hunt for devnet SOL across four sites when they could open one tap.

Six letters, a real English word, pronounceable in Indonesian and English, and unused by any project in the Solana ecosystem. Verified free at `github.com/bryankwandou/spigot` and `spigot.vercel.app` before anything else was built.

## Positioning
One line: **Devnet SOL on tap.**

Longer: Spigot is a relay for Solana devnet funding that treats rate limits as a contract rather than an obstacle. It asks each upstream faucet on that faucet's published schedule, holds what it receives in a public treasury, and hands it out through a single endpoint. Every request and every payout is a transaction anyone can look up.

What it is not: a way around a limit. Value comes from nobody else having to track four cooldown timers, not from volume.

## Colour
Water moving through metal — cool, clean, faintly industrial.

| Token | Hex | Use |
|---|---|---|
| `ink` | `#080B14` | Page background |
| `panel` | `#0E1422` | Cards, surfaces |
| `edge` | `#1C2536` | Borders, dividers |
| `mist` | `#94A3B8` | Secondary text |
| `paper` | `#F1F5F9` | Primary text |
| `aqua` | `#5EEAD4` | Gradient start, ready states |
| `sky` | `#38BDF8` | Accent, links, focus rings |
| `indigo` | `#6366F1` | Gradient end, primary action |
| amber | `#F59E0B` | Waiting, not-configured |
| rose | `#F43F5E` | Faucet refused, errors |

Signature gradient: `linear-gradient(135deg, #5EEAD4 0%, #38BDF8 55%, #6366F1 100%)`. It appears on the mark, on the primary button, on one word of the headline, and nowhere else. That restraint is the difference between a brand and a crypto landing page.

Deliberately avoided: Solana's `#14F195` and `#9945FF`. Borrowing a chain's palette makes a product look like an unofficial fan page.

## Typography
- Interface: **Inter** — 400/500/600/700, tracking `-0.03em` at display sizes.
- Numerals, addresses, signatures: **JetBrains Mono**, with `font-variant-numeric: tabular-nums`. Balances and countdowns update live; tabular figures stop the digits sliding sideways every second.

Scale: 11 / 12 / 14 / 16 / 18 / 24 / 36 / 60. Body copy at 16px, line height 1.6. No more than three sizes visible at once.

## The mark
A valve wheel seen head on — an open ring, three spokes at 120°, a solid hub — with one droplet falling clear below it. The wheel is the control, the droplet is the payout.

It earns its place because the silhouette survives at 16px in a browser tab, it is not a letterform, and it is not a rounded-square gradient blob. The gradient runs across both shapes on a single axis so the droplet reads as part of the same object rather than a sticker placed nearby.

Rules:
- Minimum 16px. Below 24px, drop the spokes; keep ring, hub, droplet.
- Clear space on every side equals the droplet's height.
- On light surfaces, replace the gradient with solid `#0E1422`. Never outline it.
- Never rotate it, never flatten it to one brand colour, never set it inside a coloured circle.

Wordmark: "Spigot" in Inter SemiBold at `-0.03em`, mark on the left aligned to cap height, gap equal to half the width of the S.

## Voice
Plain, specific, slightly understated. State what happens and when. Numbers instead of adjectives.

Write: "Next Solana request in 4h 12m."
Not: "Blazing-fast unlimited faucet, powered by AI."

Held to:
- No exclamation marks in product copy.
- No emoji in the interface.
- Never claim unlimited, instant, or free without the qualifier that makes it true.
- Failures lead, they are not buried: "The Solana faucet refused this request. Next attempt in 8h 03m."
- Second person for the reader. First person plural only for what the service does on their behalf.
- The limits page says the throughput is small, because it is.
