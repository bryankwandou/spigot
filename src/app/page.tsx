import { Mark, Wordmark } from "@/components/Mark";
import { FaucetBoard } from "@/components/FaucetBoard";
import { ClaimForm } from "@/components/ClaimForm";
import { PoolStatus } from "@/components/PoolStatus";

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
          Faucets go dry without saying so. You open four tabs, sign in twice, and find out the
          hard way. Paste an address instead: draw from a pool someone already filled, and when
          that runs out, see at a glance which faucet is still paying.
        </p>

        <div className="mt-10">
          <PoolStatus />
        </div>

        <div className="mt-6">
          <ClaimForm />
        </div>
      </section>

      <section className="mt-28 border-t border-edge pt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-mist">
          If the pool is dry, use the board
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-mist">
          Live status for every upstream faucet, plus your own cooldown once you paste an address.
          Tell it what happened after you click through and the next person sees it.
        </p>
        <div className="mt-6">
          <FaucetBoard />
        </div>
      </section>

      <section className="mt-28 border-t border-edge pt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-mist">How it works</h2>

        <ol className="mt-6 space-y-6">
          {[
            {
              n: "01",
              t: "The pool is filled by hand, on purpose",
              d: "The RPC airdrop meters on IP, not on wallet, so a hosted job collects nothing however many addresses it owns. That was measured, not assumed. Someone claims from the human-gated faucets and forwards it here, and the caps spread it across the people who could not get through at all.",
            },
            {
              n: "02",
              t: "Two clocks, because they are different questions",
              d: "Whether a faucet is paying anyone right now has nothing to do with whether you personally are past its cooldown. A faucet can be flowing and still closed to you. The board answers both, side by side.",
            },
            {
              n: "03",
              t: "One probe per window, from one address",
              d: "Spigot checks the RPC airdrop itself, once per cooldown window with three minutes of headroom, from a throwaway address it then discards. No wallet rotation, no egress rotation. Measured, not assumed: that faucet meters on IP, so extra wallets would change nothing anyway.",
            },
            {
              n: "04",
              t: "You keep your own clock",
              d: "Paste an address and it stays in your browser. Tell the board when a faucet paid you and it starts counting your next window, and everyone else sees one more data point on whether that faucet is alive.",
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
            It will not farm faucets. Rotating wallets and egress addresses to slip past a limit
            is the obvious way to make the numbers bigger, and it is the reason a project like
            this would deserve to be shut down. One identity, one request per window, published
            limits honoured with margin added on top.
          </p>
          <p>
            It will not charge you. There is no token, no fee, no paid tier, and nothing to
            connect a mainnet wallet to. Devnet SOL is given away for free by the people who
            issue it, and reselling it would be selling something that is not ours.
          </p>
          <p>
            It will not ask for your key. The pool signs with its own wallet and sends outward
            only. Nothing here requests a seed phrase, a private key, or a signature from you —
            pasting a public address is the entire interaction.
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
