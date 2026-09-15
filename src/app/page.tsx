"use client";

import { FaucetBoard } from "@/components/FaucetBoard";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Faq } from "@/components/Faq";
import { Console } from "@/components/Console";
import { Reveal } from "@/components/motion/Reveal";
import { useLang } from "@/components/Lang";

/**
 * The page reads its words rather than holding them.
 *
 * It is a client component for one reason: the language is a runtime choice and
 * the sections below carry most of the prose. Rendering them on the server in a
 * language the reader did not pick, then hydrating into a different one, is the
 * flicker this avoids. Next still renders this on the server for the first
 * response, so a crawler with no JavaScript sees the whole page in English
 * rather than an empty shell.
 */
export default function Home() {
  const { t } = useLang();

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

        {/* ---------------------------------------------------------------
            Then, before anything else: what the words mean. This sits above
            the diagnostics on purpose. Readers kept reporting that they could
            not tell what the page was offering, and the reason was that every
            section under here spends jargon — devnet, faucet, airdrop — that
            was never once defined. Explaining it costs one screen and is the
            difference between a tool and a wall of terminology.
            --------------------------------------------------------------- */}
        <section
          id="words"
          className="relative scroll-mt-24 border-y border-edge bg-panel/30"
        >
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
            <Reveal>
              <p className="t-label">{t.glossary.label}</p>
              <h2 className="t-h2 mt-3 max-w-2xl">{t.glossary.title}</h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-mist">{t.glossary.sub}</p>
            </Reveal>

            <dl className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {t.glossary.items.map((g, i) => (
                <Reveal key={g.t} delay={i * 0.05}>
                  <div className="border-t border-edge pt-5">
                    <dt className="t-h3 text-paper">{g.t}</dt>
                    <dd className="mt-2.5 text-sm leading-relaxed text-mist">{g.d}</dd>
                  </div>
                </Reveal>
              ))}
            </dl>
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        <section id="board" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28">
          <Reveal>
            <p className="t-label">{t.board.label}</p>
            <h2 className="t-h2 mt-3 max-w-2xl">{t.board.title}</h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-mist">{t.board.sub}</p>
          </Reveal>

          <Reveal delay={0.08} className="mt-10">
            <FaucetBoard />
          </Reveal>
        </section>

        {/* --------------------------------------------------------------- */}
        <section id="how" className="relative scroll-mt-24 border-y border-edge bg-panel/30">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
            <Reveal>
              <p className="t-label">{t.how.label}</p>
              <h2 className="t-h2 mt-3 max-w-2xl">{t.how.title}</h2>
            </Reveal>

            <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-edge bg-edge sm:grid-cols-2">
              {t.how.steps.map((s, i) => {
                const n = String(i + 1).padStart(2, "0");
                return (
                  <Reveal key={s.t} delay={i * 0.06}>
                    <article className="lift relative h-full overflow-hidden p-7 sm:p-8">
                      <span
                        aria-hidden
                        className="tnum pointer-events-none absolute -right-2 -top-6 font-mono text-[7rem] leading-none text-paper/[0.035]"
                      >
                        {n}
                      </span>
                      <p className="tnum font-mono text-xs text-sky">{n}</p>
                      <h3 className="t-h3 mt-3 text-paper">{s.t}</h3>
                      <p className="mt-3 max-w-md text-sm leading-relaxed text-mist">{s.d}</p>
                    </article>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* --------------------------------------------------------------- */}
        <section id="limits" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28">
          <Reveal>
            <p className="t-label">{t.limits.label}</p>
            <h2 className="t-h2 mt-3 max-w-2xl">{t.limits.title}</h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-mist">{t.limits.sub}</p>
          </Reveal>

          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {t.limits.items.map((l, i) => (
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
            <p className="t-label">{t.faq.label}</p>
            <h2 className="t-h2 mt-3">{t.faq.title}</h2>
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
              <h2 className="t-h2">{t.cta.title}</h2>
              <p className="mt-4 text-sm leading-relaxed text-mist">{t.cta.sub}</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <a
                  href="#top"
                  className="brand-gradient rounded-full px-6 py-3 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
                >
                  {t.cta.primary}
                </a>
                <a
                  href="https://github.com/bryankwandou/spigot"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-full border border-edge px-6 py-3 text-sm font-medium text-mist transition-colors hover:border-mist hover:text-paper"
                >
                  {t.cta.secondary}
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
