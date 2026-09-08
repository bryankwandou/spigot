import { FaucetBoard } from "@/components/FaucetBoard";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Faq } from "@/components/Faq";
import { Console } from "@/components/Console";
import { Reveal } from "@/components/motion/Reveal";

const STEPS = [
  {
    n: "01",
    t: "The relay asks, on a clock",
    d: "Spigot calls the two upstreams that answer a program — the devnet RPC airdrop and a keyed Helius endpoint — from one address, asking each for what it actually grants. A grant buys that faucet its full published wait plus three minutes. A refusal buys an hour, because being told the pool is empty dispenses nothing and starts no cooldown.",
  },
  {
    n: "02",
    t: "What lands, lands in one account",
    d: "Every grant goes to a single public address you can open in an explorer. Nothing is minted, nothing is bought, and nothing leaves except through the console at the top of this page.",
  },
  {
    n: "03",
    t: "You take a size, not a tour",
    d: "Paste an address, press a size, get a signature back. One grant per address every eight hours, out of six fixed sizes. No sign-in, no captcha, no four tabs.",
  },
  {
    n: "04",
    t: "Every verdict carries its age",
    d: "A board fed on someone else's cooldown cannot know what is true this second, and dressing it up as live would be inventing data. Each row prints what happened on the last check and how long ago. Past ten hours with no observation it stops claiming anything.",
  },
];

const LIMITS = [
  {
    t: "It will not farm faucets",
    d: "Rotating wallets and egress addresses to slip past a limit is the obvious way to make the numbers bigger, and the reason a project like this would deserve to be shut down. It also does not work: the RPC airdrop meters the calling IP, not the receiving wallet, so extra addresses buy nothing.",
  },
  {
    t: "It will not invent supply",
    d: "Whatever the probe collects sits in one public account and goes back out in six fixed sizes — never more than came in. When it is empty the board says so and points at the faucet most likely to pay instead.",
  },
  {
    t: "It will not charge you",
    d: "No token, no fee, no paid tier, nothing to connect a mainnet wallet to. Devnet SOL is given away free by design, and putting a price on it would be selling something that was never ours.",
  },
  {
    t: "It will not ask for your key",
    d: "Nothing here wants a seed phrase, a private key, or a signature. Pasting a public address is the entire interaction, and even that is optional.",
  },
];

export default function Home() {
  return (
    <>
      <Nav />

      <main id="top">
        {/* ---------------------------------------------------------------
            Screen one is the tool, not an argument for the tool. Everything
            below this exists for the reader who scrolls past a finished
            transaction.
            --------------------------------------------------------------- */}
        <Console />

        {/* --------------------------------------------------------------- */}
        <section id="board" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28">
          <Reveal>
            <p className="t-label">The board</p>
            <h2 className="t-h2 mt-3 max-w-2xl">Where the SOL upstairs came from.</h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-mist">
              Four upstream faucets, and what each did on its last check. You do not need any of
              this to take a grant — it is here for the day the account runs dry and you need to
              know which door is still worth knocking on.
            </p>
          </Reveal>

          <Reveal delay={0.08} className="mt-10">
            <FaucetBoard />
          </Reveal>
        </section>

        {/* --------------------------------------------------------------- */}
        <section id="how" className="relative scroll-mt-24 border-y border-edge bg-panel/30">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <Reveal>
              <p className="t-label">How it works</p>
              <h2 className="t-h2 mt-3 max-w-2xl">Four moves, none of them yours.</h2>
            </Reveal>

            <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-edge bg-edge sm:grid-cols-2">
              {STEPS.map((s, i) => (
                <Reveal key={s.n} delay={i * 0.06}>
                  <article className="lift relative h-full overflow-hidden p-7 sm:p-8">
                    <span
                      aria-hidden
                      className="tnum pointer-events-none absolute -right-2 -top-6 font-mono text-[7rem] leading-none text-paper/[0.035]"
                    >
                      {s.n}
                    </span>
                    <p className="tnum font-mono text-xs text-sky">{s.n}</p>
                    <h3 className="t-h3 mt-3 text-paper">{s.t}</h3>
                    <p className="mt-3 max-w-md text-sm leading-relaxed text-mist">{s.d}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        <section id="limits" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28">
          <Reveal>
            <p className="t-label">Limits</p>
            <h2 className="t-h2 mt-3 max-w-2xl">What Spigot will not do.</h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-mist">
              A relay that quietly broke the rules it claims to respect would be worth less than
              nothing. These are the four lines it does not cross, written down so they can be
              checked against the source.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {LIMITS.map((l, i) => (
              <Reveal key={l.t} delay={i * 0.06}>
                <article className="lift h-full rounded-2xl border border-edge p-7">
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo"
                    />
                    <h3 className="t-h3 text-paper">{l.t}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-mist">{l.d}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        <section id="faq" className="mx-auto max-w-4xl scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28">
          <Reveal>
            <p className="t-label">FAQ</p>
            <h2 className="t-h2 mt-3">Questions, answered.</h2>
          </Reveal>
          <Reveal delay={0.06}>
            <Faq />
          </Reveal>
        </section>

        {/* --------------------------------------------------------------- */}
        <section className="relative isolate overflow-hidden border-t border-edge">
          <div
            aria-hidden
            className="brand-gradient absolute inset-0 -z-10 opacity-[0.14] blur-3xl"
          />
          <div className="mx-auto max-w-3xl px-5 py-24 text-center sm:px-8 sm:py-32">
            <Reveal>
              <h2 className="t-h2">Stop keeping four cooldowns in your head.</h2>
              <p className="mt-4 text-sm leading-relaxed text-mist">
                One address, one press, one signature back. The relay has been asking on your
                behalf since before you opened this page.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <a
                  href="#top"
                  className="brand-gradient rounded-full px-6 py-3 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
                >
                  Get devnet SOL
                </a>
                <a
                  href="https://github.com/bryankwandou/spigot"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-full border border-edge px-6 py-3 text-sm font-medium text-mist transition-colors hover:border-mist hover:text-paper"
                >
                  Read the source
                </a>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
