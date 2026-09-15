"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Countdown } from "./Countdown";
import { Relay } from "./Relay";
import { useLang } from "./Lang";

type Snapshot = {
  tiers: number[];
  treasury: {
    address: string;
    sol: number | null;
    explorerUrl: string;
    affordableTier: number | null;
    signerReady: boolean;
    canDispense: boolean;
    error: string | null;
  } | null;
  scheduler: { dueAt: number | null } | null;
  faucets: Array<{ id: string; label: string; health: { status: string } }> | null;
};

type Grant = { sent: number; explorerUrl: string } | null;

/**
 * The console. One screen, one job, no scrolling to reach it.
 *
 * A person arriving here wants devnet SOL in a wallet. Every faucet that works
 * puts that transaction one field and one button away, above the fold, and
 * spends no pixels on persuasion before it. The previous front door opened on
 * a headline and asked for a scroll before the input appeared, which is a
 * brochure wearing a tool's name.
 *
 * So: address, size, confirm. The relay has already done the collecting; the
 * only thing owed by a visitor is where to send it. Everything the page has to
 * say for itself lives below this screen, for whoever wants it.
 */
export function Console() {
  const { t } = useLang();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [address, setAddress] = useState("");
  const [tier, setTier] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [grant, setGrant] = useState<Grant>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/status", { cache: "no-store" });
      setSnap(await r.json());
    } catch {
      /* keep the last good reading rather than blanking the console */
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [load]);

  // An address typed once should still be there tomorrow. It never leaves the
  // browser: no account, nothing posted until a grant is actually asked for.
  useEffect(() => {
    const saved = window.localStorage.getItem("spigot.address");
    if (saved) setAddress(saved);
  }, []);

  const tiers = snap?.tiers ?? [];
  const treasury = snap?.treasury ?? null;
  const affordable = treasury?.affordableTier ?? null;

  // Default to the largest size this account can actually cover, so the button
  // is armed on arrival instead of asking for a decision nobody has an opinion
  // about yet. Re-clamp when the balance drops under a size already picked:
  // otherwise the button stays armed for a grant the server will refuse.
  useEffect(() => {
    if (affordable === null) return;
    if (tier === null || tier > affordable) setTier(affordable);
  }, [tier, affordable]);

  const valid = address.trim().length >= 32 && address.trim().length <= 44;
  const ready = valid && tier !== null && treasury?.canDispense === true && !sending;

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || tier === null) return;

    const addr = address.trim();
    window.localStorage.setItem("spigot.address", addr);

    setSending(true);
    setGrant(null);
    setError(null);
    try {
      const r = await fetch("/api/dispense", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: addr, sol: tier }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok) {
        setError(body?.error ?? t.console.errAnswer);
        return;
      }
      setGrant({ sent: body.sent, explorerUrl: body.explorerUrl });
      await load();
    } catch {
      setError(t.console.errReach);
    } finally {
      setSending(false);
    }
  }

  const flowing = snap?.faucets?.filter((f) => f.health.status === "flowing").length ?? null;
  const upstreams = snap?.faucets?.length ?? 4;

  // Why the button is off, in the words of the thing that turned it off. A
  // disabled control with no explanation is the single most common way a
  // working tool reads as broken.
  const blocked =
    treasury === null
      ? null
      : !treasury.signerReady
        ? t.console.blockedNoKey
        : !treasury.canDispense
          ? t.console.blockedEmpty
          : null;

  return (
    <section className="relative isolate flex min-h-[100dvh] flex-col overflow-hidden">
      <div aria-hidden className="grid-lines absolute inset-0 -z-10" />
      <Relay className="absolute inset-x-0 top-0 -z-10 h-[70vh] w-full opacity-60" />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 -z-10 h-64 bg-gradient-to-b from-transparent to-ink"
      />

      {/* An instrument panel, not a centred document. The control column carries
          the whole transaction; the rail beside it carries the three numbers
          that say whether the transaction will work. Splitting them 7/5 puts
          the readings in peripheral vision while the hands stay on the left,
          and stops the screen reading as a stack of centred paragraphs. Below
          `lg` there is not enough width for two columns to be anything but
          cramped, so it folds back to one. */}
      <div className="flex flex-1 items-center px-5 pb-[clamp(0.5rem,2vh,1.75rem)] pt-[clamp(4.75rem,11vh,7rem)] sm:px-8">
        <div className="mx-auto grid w-full max-w-2xl items-center gap-[clamp(0.7rem,2.4vh,1.6rem)] lg:max-w-5xl lg:grid-cols-12 lg:gap-x-12">
          <div className="flex flex-col gap-[clamp(0.7rem,2.4vh,1.6rem)] lg:col-span-7">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-center lg:text-left"
          >
            <p className="inline-flex items-center gap-2.5 rounded-full border border-edge bg-panel/70 px-3.5 py-1.5 text-xs text-mist">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-aqua" />
              {t.console.badge}
            </p>

            <h1 className="mt-4 text-[clamp(1.75rem,4.3vw,2.75rem)] font-bold leading-[1.02] tracking-[-0.035em]">
              {t.console.titleA} <span className="brand-text">{t.console.titleB}</span>.
            </h1>

            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-mist sm:text-base lg:mx-0">
              {t.console.sub}
            </p>
          </motion.div>

          <motion.form
            onSubmit={confirm}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="lift rounded-2xl border border-edge p-5 sm:p-6"
          >
            <label htmlFor="addr" className="t-label">
              {t.console.addressLabel}
            </label>
            <input
              id="addr"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t.console.addressPlaceholder}
              spellCheck={false}
              autoComplete="off"
              className="mt-2.5 w-full min-w-0 rounded-xl border border-edge bg-ink px-4 py-3 font-mono text-sm text-paper transition-colors placeholder:text-mist/60 focus:border-sky"
            />

            <div className="mt-[clamp(0.85rem,2vh,1.25rem)] flex items-baseline justify-between gap-3">
              <span className="t-label">{t.console.amountLabel}</span>
              <span className="text-xs text-mist">{t.console.amountNote}</span>
            </div>

            <div className="mt-2.5 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {tiers.map((amount) => {
                const short = affordable !== null && amount > affordable;
                const picked = tier === amount;
                return (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setTier(amount)}
                    disabled={short}
                    aria-pressed={picked}
                    title={short ? t.console.amountTooBig : undefined}
                    className={`tnum rounded-xl border px-2 py-2.5 font-mono text-sm transition-colors disabled:opacity-25 ${
                      picked
                        ? "border-aqua bg-aqua/10 text-aqua"
                        : "border-edge bg-ink text-mist enabled:hover:border-mist enabled:hover:text-paper"
                    }`}
                  >
                    {amount}
                  </button>
                );
              })}
              {tiers.length === 0 &&
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-[42px] rounded-xl border border-edge bg-ink/50" />
                ))}
            </div>

            <button
              type="submit"
              disabled={!ready}
              className={`mt-[clamp(0.85rem,2vh,1.25rem)] w-full rounded-xl px-5 py-3.5 text-sm font-semibold transition-[background-color,color,opacity,border-color] duration-200 ${
                ready
                  ? "brand-gradient text-ink hover:opacity-90"
                  : "cursor-not-allowed border border-edge bg-panel text-mist"
              }`}
            >
              {sending ? t.console.sending : t.console.submit}
            </button>

            <AnimatePresence mode="wait">
              {grant ? (
                <motion.p
                  key="ok"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="status"
                  className="mt-3.5 rounded-xl border border-aqua/30 bg-aqua/5 px-3.5 py-2.5 text-center text-xs text-aqua"
                >
                  {t.console.sentA} {grant.sent} {t.console.sentB}{" "}
                  <a
                    href={grant.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4"
                  >
                    {t.console.receipt}
                  </a>
                </motion.p>
              ) : error ? (
                <motion.p
                  key="err"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="status"
                  className="mt-3.5 text-center text-xs leading-relaxed text-rose-300"
                >
                  {error}
                </motion.p>
              ) : blocked ? (
                <motion.p
                  key="blocked"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-3.5 text-center text-xs leading-relaxed text-mist"
                >
                  {blocked}
                </motion.p>
              ) : !valid && address.length > 0 ? (
                <motion.p
                  key="len"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-3.5 text-center text-xs text-mist"
                >
                  {t.console.badLength}
                </motion.p>
              ) : null}
            </AnimatePresence>
          </motion.form>
          </div>

          {/* The rail. Three figures, all read off devnet rather than asserted,
              standing where a marketing strap would otherwise go. Side by side
              on a phone, stacked into a column of gauges once there is a rail
              to stack them in. */}
          <div className="flex flex-col gap-[clamp(0.7rem,2.4vh,1.6rem)] lg:col-span-5">
          <motion.dl
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-edge bg-edge lg:grid-cols-1"
          >
            <Cell label={t.console.statBalance}>
              {treasury?.sol == null ? (
                <span className="text-mist">—</span>
              ) : (
                <>
                  {treasury.sol.toFixed(3)}
                  <span className="ml-1 text-xs text-mist">SOL</span>
                </>
              )}
            </Cell>
            <Cell label={t.console.statFaucets}>
              {flowing === null ? (
                <span className="text-mist">—</span>
              ) : (
                <>
                  {flowing}
                  <span className="text-xs text-mist">/{upstreams}</span>
                </>
              )}
            </Cell>
            <Cell label={t.console.statNext}>
              {snap?.scheduler?.dueAt ? (
                <Countdown to={snap.scheduler.dueAt} />
              ) : (
                <span className="text-mist">—</span>
              )}
            </Cell>
          </motion.dl>

          <p className="text-center text-xs text-mist lg:text-left">
            {treasury ? (
              <a
                href={treasury.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono underline decoration-edge underline-offset-4 transition-colors hover:text-paper"
              >
                {treasury.address.slice(0, 8)}…{treasury.address.slice(-8)}
              </a>
            ) : (
              t.console.reading
            )}{" "}
            {t.console.readNote}
          </p>
          </div>
        </div>
      </div>

      <a
        href="#board"
        className="mx-auto mb-[clamp(0.7rem,2vh,1.5rem)] flex shrink-0 items-center gap-2 text-xs text-mist transition-colors hover:text-paper"
      >
        {t.console.scroll}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M6 1v9M2 6.5 6 10.5l4-4" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </a>
    </section>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    // Three across on a phone, where width is the scarce thing; a labelled row
    // with the value flush right once it is a rail, where height is.
    <div className="bg-panel px-3 py-3.5 text-center sm:px-4 lg:flex lg:items-baseline lg:justify-between lg:gap-4 lg:px-5 lg:py-4 lg:text-left">
      <dt className="t-label">{label}</dt>
      <dd className="tnum mt-1.5 font-mono text-base text-paper sm:text-lg lg:mt-0 lg:text-xl">
        {children}
      </dd>
    </div>
  );
}
