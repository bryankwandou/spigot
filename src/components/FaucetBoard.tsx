"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Countdown } from "./Countdown";

type Status = "flowing" | "patchy" | "dry" | "unknown";

type Row = {
  id: string;
  label: string;
  access: "server" | "human";
  meters: string;
  cooldownMs: number;
  expectedSol: number;
  claimUrl: string;
  note: string;
  health: { status: Status; successRate: number | null; sample: number; lastGrantedAt: number | null };
  summary: string;
  yourLastClaimAt: number | null;
  yourNextEligibleAt: number | null;
};

type Treasury = {
  address: string;
  lamports: number | null;
  sol: number | null;
  explorerUrl: string;
  affordableTier: number | null;
  canDispense: boolean;
  error: string | null;
};

type Grant = { sent: number; explorerUrl: string } | null;

type Scheduler = {
  lastProbeAt: number | null;
  dueAt: number | null;
  overdueByMs: number;
  healthy: boolean;
};

const DOT: Record<Status, string> = {
  flowing: "bg-aqua",
  patchy: "bg-amber-400",
  dry: "bg-rose-500",
  unknown: "bg-edge",
};

const LABEL: Record<Status, string> = {
  flowing: "flowing",
  patchy: "patchy",
  dry: "dry",
  unknown: "unrated",
};

function hours(ms: number): string {
  return `${Math.round(ms / 3_600_000)}h`;
}

/**
 * The board.
 *
 * Two questions get answered per row and they are different questions: is this
 * faucet paying anyone at all right now, and are *you* allowed to ask it yet.
 * A faucet can be flowing and still closed to you, which is precisely the
 * information that four browser tabs fail to give you.
 */
export function FaucetBoard() {
  const [address, setAddress] = useState("");
  const [tracked, setTracked] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [scheduler, setScheduler] = useState<Scheduler | null>(null);
  const [treasury, setTreasury] = useState<Treasury | null>(null);
  const [tiers, setTiers] = useState<number[]>([]);
  const [dispensed, setDispensed] = useState<{ count: number; sol: number } | null>(null);
  const [grant, setGrant] = useState<Grant>(null);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [asking, setAsking] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Keyed by faucet so a rejection appears against the row it belongs to.
  const [notice, setNotice] = useState<{ faucetId: string; text: string } | null>(null);

  const load = useCallback(async (addr: string | null) => {
    const q = addr ? `?address=${encodeURIComponent(addr)}` : "";
    try {
      const r = await fetch(`/api/status${q}`, { cache: "no-store" });
      const j = await r.json();
      setRows(j.faucets ?? []);
      setScheduler(j.scheduler ?? null);
      setTreasury(j.treasury ?? null);
      setTiers(j.tiers ?? []);
      setDispensed(j.dispensed ?? null);
    } catch {
      /* leave the previous board up rather than blanking it on a blip */
    }
  }, []);

  useEffect(() => {
    load(tracked);
    const id = setInterval(() => load(tracked), 20_000);
    return () => clearInterval(id);
  }, [load, tracked]);

  useEffect(() => {
    const saved = window.localStorage.getItem("spigot.address");
    if (saved) {
      setAddress(saved);
      setTracked(saved);
    }
  }, []);

  function track(e: React.FormEvent) {
    e.preventDefault();
    const a = address.trim();
    if (!a) return;
    window.localStorage.setItem("spigot.address", a);
    setTracked(a);
  }

  function forget() {
    window.localStorage.removeItem("spigot.address");
    setTracked(null);
    setAddress("");
  }

  async function report(faucetId: string, outcome: "granted" | "dry") {
    if (!tracked) return;
    setBusy(faucetId + outcome);
    setNotice(null);
    try {
      const r = await fetch("/api/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ faucetId, address: tracked, outcome }),
      });

      // An ignored response is how a refused write comes to look like a
      // successful one: the board reloads, nothing has changed, and the person
      // walks away believing they contributed. Say what happened instead.
      if (!r.ok) {
        const body = (await r.json().catch(() => null)) as { error?: string } | null;
        setNotice({
          faucetId,
          text: body?.error ?? "That report was not recorded.",
        });
        return;
      }

      await load(tracked);
    } catch {
      setNotice({ faucetId, text: "Could not reach the board. Your report was not saved." });
    } finally {
      setBusy(null);
    }
  }

  async function ask(sol: number) {
    if (!tracked) return;
    setAsking(sol);
    setGrant(null);
    setGrantError(null);
    try {
      const r = await fetch("/api/dispense", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: tracked, sol }),
      });
      const body = await r.json().catch(() => null);
      if (!r.ok) {
        setGrantError(body?.error ?? "The dispenser did not answer.");
        return;
      }
      setGrant({ sent: body.sent, explorerUrl: body.explorerUrl });
      await load(tracked);
    } catch {
      setGrantError("Could not reach the dispenser. Nothing was sent.");
    } finally {
      setAsking(null);
    }
  }

  // A board with nothing to say and a board nobody is asking are the same
  // picture from the outside, and only one of them is our fault. Say which.
  const stalled = scheduler !== null && !scheduler.healthy;

  return (
    <div>
      {stalled && (
        <p
          role="status"
          className="mb-6 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
        >
          The scheduled check has not run in over a day, so every reading below is
          older than it looks. This is a fault on our side, not a verdict on the
          faucets.
        </p>
      )}
      {treasury && (
        <section className="mb-6 rounded-lg border border-edge bg-white/[0.02] px-4 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium text-mute">Collected so far</h2>
            <a
              href={treasury.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-mute underline decoration-edge underline-offset-4 hover:text-fg"
            >
              {treasury.address.slice(0, 6)}…{treasury.address.slice(-6)}
            </a>
          </div>
          <p className="mt-2 font-mono text-2xl tabular-nums text-fg">
            {treasury.sol === null ? "—" : `${treasury.sol.toFixed(4)} SOL`}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-mute">
            {treasury.error
              ? "The balance could not be read just now. The address above is still the one being filled."
              : "Read from devnet, not from our own log. Every eight hours the schedule asks the airdrop once and sends whatever it gets here. Most asks are refused — this account fills when the faucet recovers, not on demand."}
            {dispensed && dispensed.count > 0 && (
              <> {dispensed.sol.toFixed(2)} SOL has gone back out across {dispensed.count} grants.</>
            )}
          </p>

          {tracked ? (
            <div className="mt-4 border-t border-edge pt-4">
              <p className="mb-2 text-xs text-mute">
                One grant per address every eight hours. Pick a size.
              </p>
              <div className="flex flex-wrap gap-2">
                {tiers.map((t) => {
                  const short = treasury.affordableTier !== null && t > treasury.affordableTier;
                  const off = !treasury.canDispense || short || asking !== null;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => ask(t)}
                      disabled={off}
                      className="rounded border border-edge px-3 py-1.5 font-mono text-sm tabular-nums transition-colors enabled:hover:border-aqua enabled:hover:text-aqua disabled:opacity-30"
                      title={short ? "More than the treasury can cover right now" : undefined}
                    >
                      {asking === t ? "sending…" : `${t} SOL`}
                    </button>
                  );
                })}
              </div>
              {!treasury.canDispense && !treasury.error && (
                <p className="mt-2 text-xs text-mute">
                  {treasury.affordableTier === null
                    ? "Nothing to hand out yet. The account fills from the faucet, which is refusing us too."
                    : "The dispenser is not configured to sign, so nothing can be sent right now."}
                </p>
              )}
              {grantError && (
                <p role="status" className="mt-2 text-xs text-rose-300">
                  {grantError}
                </p>
              )}
              {grant && (
                <p role="status" className="mt-2 text-xs text-aqua">
                  Sent {grant.sent} SOL.{" "}
                  <a
                    href={grant.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4"
                  >
                    See the transaction
                  </a>
                </p>
              )}
            </div>
          ) : (
            <p className="mt-4 border-t border-edge pt-4 text-xs text-mute">
              Enter an address below to request a grant.
            </p>
          )}
        </section>
      )}
      <form onSubmit={track} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Your devnet address"
          spellCheck={false}
          aria-label="Your devnet address"
          className="min-w-0 flex-1 rounded-lg border border-edge bg-panel px-4 py-3 font-mono text-sm text-paper placeholder:text-mist/60"
        />
        <button
          type="submit"
          className="brand-gradient rounded-lg px-5 py-3 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
        >
          Track my clock
        </button>
      </form>

      <AnimatePresence>
        {tracked && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 text-xs text-mist"
          >
            Following{" "}
            <span className="font-mono text-paper">
              {tracked.slice(0, 4)}…{tracked.slice(-4)}
            </span>{" "}
            in this browser only.{" "}
            <button onClick={forget} className="underline decoration-edge underline-offset-4 hover:text-paper">
              Forget it
            </button>
          </motion.p>
        )}
      </AnimatePresence>

      <ul className="mt-6 space-y-3">
        {(rows ?? []).map((f, i) => {
          const ready = f.yourNextEligibleAt !== null && f.yourNextEligibleAt <= Date.now();
          return (
            <motion.li
              key={f.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.24 }}
              className="rounded-xl border border-edge bg-panel p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[f.health.status]}`} />
                    <h3 className="font-medium text-paper">{f.label}</h3>
                    <span className="text-xs text-mist">{LABEL[f.health.status]}</span>
                  </div>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-mist">{f.note}</p>
                  <p className="mt-2 text-xs text-mist">
                    {f.health.sample > 0 ? (
                      <>
                        <span className="tnum text-paper">
                          {f.health.successRate === null
                            ? "—"
                            : `${Math.round(f.health.successRate * 100)}%`}
                        </span>{" "}
                        paid out across{" "}
                        <span className="tnum text-paper">{f.health.sample}</span> recent
                        {f.health.sample === 1 ? " report" : " reports"}
                      </>
                    ) : (
                      "No reports in the last 90 minutes"
                    )}
                  </p>
                </div>

                <div className="text-right">
                  <p className="tnum text-sm font-medium text-paper">~{f.expectedSol} SOL</p>
                  <p className="mt-0.5 text-xs text-mist">every {hours(f.cooldownMs)}</p>
                  {tracked && f.yourNextEligibleAt !== null && (
                    <p className="mt-2 text-xs text-mist">
                      you: <Countdown to={f.yourNextEligibleAt} />
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-edge pt-4">
                <a
                  href={f.claimUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                    ready || !tracked
                      ? "bg-paper text-ink hover:opacity-90"
                      : "border border-edge text-mist hover:text-paper"
                  }`}
                >
                  {tracked && !ready ? "Open anyway" : "Open faucet"}
                </a>

                {tracked && (
                  <>
                    <button
                      onClick={() => report(f.id, "granted")}
                      disabled={busy !== null}
                      className="rounded-lg border border-edge px-3.5 py-2 text-sm text-mist transition-colors hover:text-paper disabled:opacity-40"
                    >
                      {busy === f.id + "granted" ? "Saving" : "It paid"}
                    </button>
                    <button
                      onClick={() => report(f.id, "dry")}
                      disabled={busy !== null}
                      className="rounded-lg border border-edge px-3.5 py-2 text-sm text-mist transition-colors hover:text-paper disabled:opacity-40"
                    >
                      {busy === f.id + "dry" ? "Saving" : "It was dry"}
                    </button>
                  </>
                )}
              </div>

              {notice?.faucetId === f.id && (
                <p role="status" className="mt-3 text-xs text-mist">
                  {notice.text}
                </p>
              )}
            </motion.li>
          );
        })}
      </ul>

      {rows === null && <p className="mt-6 text-sm text-mist">Reading the board…</p>}
    </div>
  );
}
