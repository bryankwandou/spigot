import { Mark, Wordmark } from "@/components/Mark";
import { FaucetBoard } from "@/components/FaucetBoard";

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
          Find out which faucet is <span className="brand-text">actually paying</span>.
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-mist">
          Devnet faucets go dry without announcing it. You open four tabs, sign in twice, clear a
          human check, and get nothing. Spigot keeps a record of what each one did the last time
          anybody asked, so you spend one click instead of four.
        </p>
      </section>

      <section className="mt-16">
        <FaucetBoard />
      </section>

      <section className="mt-28 border-t border-edge pt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-mist">How it works</h2>

        <ol className="mt-6 space-y-6">
          {[
            {
              n: "01",
              t: "An ask every hour while it is dry, every eight once it pays",
              d: "Spigot calls the devnet RPC airdrop itself, from one address, on a clock that depends on the answer. A grant buys the upstream its full published limit of eight hours plus three minutes of headroom. A refusal buys an hour, because being told the faucet has run dry dispenses nothing and starts no cooldown — and devnet refills and empties faster than eight hours. One identity, one request per window, no rotation of any kind.",
            },
            {
              n: "02",
              t: "Reports from developers fill the gaps",
              d: "Two of the three faucets sit behind a human check, so no automated probe can reach them honestly. What can reach them is you, after you click through. Say whether it paid, and the next person reads it instead of finding out the hard way.",
            },
            {
              n: "03",
              t: "The verdict comes with its age attached",
              d: "A board fed on someone else's cooldown cannot tell you what is true this second, and dressing it up as live would be inventing data. Each row shows what happened on the last check and how long ago that was. Past ten hours with no observation it stops claiming anything at all.",
            },
            {
              n: "04",
              t: "Your own clock stays yours",
              d: "Paste an address and it stays in your browser. Tell the board a faucet paid you and it starts counting your personal cooldown — a separate question from whether that faucet is paying anyone, and one the other tabs never answer.",
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
            It will not farm faucets. Rotating wallets and egress addresses to slip past a limit is
            the obvious way to make the numbers look bigger, and it is the reason a project like
            this would deserve to be shut down. It also does not work: the RPC airdrop was measured
            counting against the calling IP rather than the receiving wallet, so extra addresses buy
            nothing. One identity, one request per window, published limits honoured with margin on
            top.
          </p>
          <p>
            It will not invent supply. Whatever the probe collects sits in one public account and
            goes back out in six fixed sizes, one per address per window — never more than came in.
            When that account is empty the board says so and points you at the faucet most likely to
            pay instead. The SOL still comes from the people who issue it, on their terms; Spigot
            only holds the door open between their good moments and yours.
          </p>
          <p>
            It will not charge you. No token, no fee, no paid tier, nothing to connect a mainnet
            wallet to. Devnet SOL is given away for free by design, and putting a price on it would
            be selling something that was never ours.
          </p>
          <p>
            It will not ask for your key. Nothing here wants a seed phrase, a private key, or a
            signature. Pasting a public address is the entire interaction, and even that is
            optional.
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
