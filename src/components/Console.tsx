"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Countdown } from "./Countdown";
import { Relay } from "./Relay";

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
  // about yet.
  useEffect(() => {
    if (tier === null && affordable !== null) setTier(affordable);
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
        setError(body?.error ?? "The dispenser did not answer.");
        return;
      }
      setGrant({ sent: body.sent, explorerUrl: body.explorerUrl });
      await load();
    } catch {
      setError("Could not reach the dispenser. Nothing was sent.");
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
        ? "The dispenser has no signing key configured, so nothing can be sent."
        : !treasury.canDispense
          ? "The account is empty right now. The board below says which upstream is closest to paying."
          : null;

  return (
    <section className="relative isolate flex min-h-[100dvh] flex-col overflow-hidden">
      <div aria-hidden className="grid-lines absolute inset-0 -z-10" />
      <Relay className="absolute inset-x-0 top-0 -z-10 h-[70vh] w-full opacity-60" />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 -z-10 h-64 bg-gradient-to-b from-transparent to-ink"
      />

      <div className="flex flex-1 items-center justify-center px-5 pb-[clamp(0.5rem,2vh,1.75rem)] pt-[clamp(4.75rem,11vh,7rem)] sm:px-8">
        <div className="flex w-full max-w-2xl flex-col gap-[clamp(0.7rem,2.4vh,1.6rem)]">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="text-center"
          >
            <p className="inline-flex items-center gap-2.5 rounded-full border border-edge bg-panel/70 px-3.5 py-1.5 text-xs text-mist">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-aqua" />
              Solana devnet · the relay is collecting now
            </p>

            <h1 className="mt-4 text-[clamp(1.75rem,4.3vw,2.75rem)] font-bold leading-[1.02] tracking-[-0.035em]">
              Devnet SOL, <span className="brand-text">already collected</span>.
            </h1>

            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-mist sm:text-base">
              No sign-in, no human check, no hunting four faucets. Paste an address and confirm.
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
              Wallet address
            </label>
            <input
              id="addr"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Paste your devnet address"
              spellCheck={false}
              autoComplete="off"
              className="mt-2.5 w-full min-w-0 rounded-xl border border-edge bg-ink px-4 py-3 font-mono text-sm text-paper transition-colors placeholder:text-mist/60 focus:border-sky"
            />

            <div className="mt-[clamp(0.85rem,2vh,1.25rem)] flex items-baseline justify-between gap-3">
              <span className="t-label">Amount</span>
              <span className="text-xs text-mist">One grant per address every 8h</span>
            </div>

            <div className="mt-2.5 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {tiers.map((t) => {
                const short = affordable !== null && t > affordable;
                const picked = tier === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTier(t)}
                    disabled={short}
                    aria-pressed={picked}
                    title={short ? "More than the account can cover right now" : undefined}
                    className={`tnum rounded-xl border px-2 py-2.5 font-mono text-sm transition-all disabled:opacity-25 ${
                      picked
                        ? "border-aqua bg-aqua/10 text-aqua"
                        : "border-edge bg-ink text-mist enabled:hover:border-mist enabled:hover:text-paper"
                    }`}
                  >
                    {t}
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
              className={`mt-[clamp(0.85rem,2vh,1.25rem)] w-full rounded-xl px-5 py-3.5 text-sm font-semibold transition-all ${
                ready
                  ? "brand-gradient text-ink hover:opacity-90"
                  : "cursor-not-allowed border border-edge bg-panel text-mist"
              }`}
            >
              {sending ? "Sending…" : "Confirm airdrop"}
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
                  Sent {grant.sent} SOL.{" "}
                  <a
                    href={grant.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4"
                  >
                    See the transaction
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
                  That is not the length of a Solana address.
                </motion.p>
              ) : null}
            </AnimatePresence>
          </motion.form>

          {/* Three figures, all read rather than asserted, in the space a
              marketing strap would otherwise occupy. */}
          <motion.dl
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-edge bg-edge"
          >
            <Cell label="In the account">
              {treasury?.sol == null ? (
                <span className="text-mist">—</span>
              ) : (
                <>
                  {treasury.sol.toFixed(3)}
                  <span className="ml-1 text-xs text-mist">SOL</span>
                </>
              )}
            </Cell>
            <Cell label="Upstreams paying">
              {flowing === null ? (
                <span className="text-mist">—</span>
              ) : (
                <>
                  {flowing}
                  <span className="text-xs text-mist">/{upstreams}</span>
                </>
              )}
            </Cell>
            <Cell label="Next ask">
              {snap?.scheduler?.dueAt ? (
                <Countdown to={snap.scheduler.dueAt} />
              ) : (
                <span className="text-mist">—</span>
              )}
            </Cell>
          </motion.dl>

          <p className="text-center text-xs text-mist">
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
              "Reading the account…"
            )}{" "}
            · balance read off devnet every 20s
          </p>
        </div>
      </div>

      <a
        href="#board"
        className="mx-auto mb-[clamp(0.7rem,2vh,1.5rem)] flex shrink-0 items-center gap-2 text-xs text-mist transition-colors hover:text-paper"
      >
        Which faucet is paying, and how this works
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <path d="M6 1v9M2 6.5 6 10.5l4-4" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </a>
    </section>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-panel px-3 py-3.5 text-center sm:px-4">
      <dt className="t-label">{label}</dt>
      <dd className="tnum mt-1.5 font-mono text-base text-paper sm:text-lg">{children}</dd>
    </div>
  );
}
