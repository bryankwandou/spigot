import { Mark, Wordmark } from "@/components/Mark";
import { ClaimForm } from "@/components/ClaimForm";
import { FaucetTable } from "@/components/FaucetTable";

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-6 pb-32">
      <header className="flex items-center justify-between py-8">
        <Wordmark />
        <a
          href="https://github.com/bryankwandou/spigot"
          className="text-sm text-mist underline decoration-edge underline-offset-4 transition-colors hover:text-paper"
        >
          Source
        </a>
      </header>

      <section className="pt-16 sm:pt-24">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-edge bg-panel px-3 py-1 text-xs text-mist">
          <span className="h-1.5 w-1.5 rounded-full bg-aqua" />
          Solana devnet
        </p>

        <h1 className="max-w-2xl text-4xl font-bold leading-[1.08] tracking-[-0.03em] sm:text-6xl">
          Devnet SOL <span className="brand-text">on tap</span>.
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-mist">
          Funding a devnet wallet means visiting four sites, solving three captchas, and
          remembering which one you used yesterday. Spigot keeps that bookkeeping so you can
          paste an address and get back to work.
        </p>

        <div className="mt-10">
          <ClaimForm />
        </div>
      </section>

      <section className="mt-28 border-t border-edge pt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-mist">
          What the pool is doing
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-mist">
          Every upstream faucet, its published limit, and when Spigot is next allowed to ask.
          The numbers update on their own.
        </p>
        <div className="mt-6">
          <FaucetTable />
        </div>
      </section>

      <section className="mt-28 border-t border-edge pt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-mist">
          How it works
        </h2>

        <ol className="mt-6 space-y-6">
          {[
            {
              n: "01",
              t: "A schedule wakes up, it does not decide",
              d: "A job runs every half hour and asks the relay which faucets are due. The relay owns the clock. A fixed eight-hour timer drifts and eventually fires early, which is exactly the mistake that gets an address blocked.",
            },
            {
              n: "02",
              t: "One identity, one attempt",
              d: "Each faucet is asked once per window from the same treasury address. Spigot does not rotate wallets or egress addresses. A refusal is written down and the next window is measured from that moment, so it backs off instead of pushing.",
            },
            {
              n: "03",
              t: "Three minutes of headroom",
              d: "Every cooldown carries a deliberate margin on top of the published figure. Server clocks disagree by seconds and a request that lands one second early counts as early.",
            },
            {
              n: "04",
              t: "The pool pays out",
              d: "What arrives sits in one public devnet address. You take one SOL per request, up to five a day, and the transaction signature is yours to check on an explorer.",
            },
          ].map((s) => (
            <li key={s.n} className="flex gap-5">
              <span className="tnum shrink-0 pt-0.5 font-mono text-sm text-sky">{s.n}</span>
              <div>
                <h3 className="font-medium text-paper">{s.t}</h3>
                <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-mist">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-28 border-t border-edge pt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-mist">
          What Spigot will not do
        </h2>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-mist">
          <p>
            It will not farm faucets. Rotating wallets and addresses to slip past a rate limit is
            the obvious way to make the numbers bigger, and it is the reason this project would
            deserve to be shut down. One identity per faucet, published limits honoured, margin
            added on top.
          </p>
          <p>
            It will not pretend the throughput is larger than it is. Two of the three upstream
            faucets are gated by a human check on purpose, so Spigot shows their timers and a
            person clicks. Automated intake is roughly two SOL every eight hours. That is a small
            number, and it is the real one.
          </p>
          <p>
            It will not touch mainnet. These are devnet tokens. They are worth nothing and are
            meant to stay that way.
          </p>
        </div>
      </section>

      <footer className="mt-28 flex items-center gap-3 border-t border-edge pt-8">
        <Mark size={20} id="footer" />
        <p className="text-xs text-mist">
          Spigot — devnet infrastructure. Not affiliated with Solana Labs or the Solana Foundation.
        </p>
      </footer>
    </main>
  );
}
