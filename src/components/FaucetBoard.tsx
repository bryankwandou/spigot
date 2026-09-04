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
  signerReady: boolean;
  canDispense: boolean;
  error: string | null;
};

type Grant = { sent: number; explorerUrl: string } | null;

type Capacity = {
  spendableSol: number;
  reservedSol: number;
  grantsPerTier: Array<{ sol: number; grants: number }>;
  maxGrants: number;
  dailyCeilingSol: number;
  daysToFillLargestTier: number | null;
};

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
  const [capacity, setCapacity] = useState<Capacity | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [grant, setGrant] = useState<Grant>(null);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [asking, setAsking] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Keyed by faucet so a rejection appears against the row it belongs to.
  const [notice, setNotice] = useState<{ faucetId: string; text: string } | null>(null);

  /**
   * Hand a volunteer the treasury address and the faucet, and get out of the way.
   *
   * This is the one place the community can add supply that no schedule can
   * reach: the two web faucets sit behind a sign-in and a human check, which an
   * automated probe cannot honestly pass. A person can, once, as themselves.
   *
   * What it deliberately does not do is pretend that more clicks mean more SOL.
   * Both of these meter on the receiving address, so the first volunteer of the
   * window fills the account and everyone after is refused. Saying otherwise
   * would send people to spend their own daily allowance on a request that was
   * never going to land.
   */
  const copyAddress = useCallback(async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied("address");
      window.setTimeout(() => setCopied(null), 4000);
    } catch {
      // Refused clipboard access is survivable: the address is rendered in full
      // beside this button precisely so it can be selected by hand.
    }
  }, []);

  const helpFill = useCallback(async (faucetId: string, claimUrl: string, addr: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(faucetId);
      window.setTimeout(() => setCopied(null), 4000);
    } catch {
      // Clipboard access can be refused outright, and the address is on screen
      // anyway. Opening the faucet is still the useful half.
    }
    window.open(claimUrl, "_blank", "noopener,noreferrer");
  }, []);

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
      setCapacity(j.capacity ?? null);
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


  const humanRows = (rows ?? []).filter((r) => r.access === "human");

  return (
    <div className="space-y-10">
      {stalled && (
        <p
          role="status"
          className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
        >
          The scheduled check has not run in over a day, so every reading below is older than it
          looks. This is a fault on our side, not a verdict on the faucets.
        </p>
      )}

      {/* -----------------------------------------------------------------
          The dispenser.

          This is the product, so it goes first and it gets the room. The
          earlier build put the treasury readout at the top and the way to
          actually receive SOL three screens down, under a heading about
          helping to fill the account — which read as a page whose main verb
          was "go and beg a faucet on our behalf". It is the other way round:
          the relay has been collecting for hours already, and the only thing
          asked of a visitor is an address.
          ----------------------------------------------------------------- */}
      <section className="lift overflow-hidden rounded-2xl border border-edge">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          {/* Left: what is in the account, read off devnet. */}
          <div className="border-b border-edge p-6 sm:p-8 lg:border-b-0 lg:border-r">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="t-label">In the shared account</h2>
              {treasury && (
                <a
                  href={treasury.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-mist underline decoration-edge underline-offset-4 transition-colors hover:text-paper"
                >
                  {treasury.address.slice(0, 6)}…{treasury.address.slice(-6)}
                </a>
              )}
            </div>

            <p className="tnum mt-3 font-mono text-4xl leading-none text-paper sm:text-5xl">
              {treasury?.sol == null ? (
                <span className="text-mist">—</span>
              ) : (
                <>
                  {treasury.sol.toFixed(3)}
                  <span className="ml-2 text-lg text-mist">SOL</span>
                </>
              )}
            </p>

            {capacity && (
              <dl className="mt-6 space-y-3 border-t border-edge pt-5">
                <Line
                  label="Ready to hand out"
                  value={`${capacity.spendableSol.toFixed(3)} SOL`}
                />
                <Line
                  label="Grants left at 0.1 SOL"
                  value={String(capacity.maxGrants)}
                />
                <Line
                  label="Refills at most"
                  value={`${capacity.dailyCeilingSol.toFixed(1)} SOL/day`}
                />
                <Line label="Held back for fees" value={`${capacity.reservedSol.toFixed(2)} SOL`} quiet />
              </dl>
            )}

            {capacity && capacity.maxGrants === 0 && capacity.daysToFillLargestTier !== null && (
              <p className="mt-5 text-xs leading-relaxed text-mist">
                Empty right now. At the published rates a full 3 SOL tier is about{" "}
                <span className="tnum font-mono text-paper">
                  {capacity.daysToFillLargestTier.toFixed(1)}
                </span>{" "}
                days of collecting away — and that is a ceiling, not a forecast. It assumes every
                ask is granted, and most are refused.
              </p>
            )}

            <p className="mt-5 text-xs leading-relaxed text-mist">
              {treasury?.error
                ? "The balance could not be read just now. The address above is still the one being filled."
                : "Read from devnet every twenty seconds, not from our own log."}
              {dispensed && dispensed.count > 0 && (
                <>
                  {" "}
                  <span className="tnum font-mono text-paper">
                    {dispensed.sol.toFixed(2)} SOL
                  </span>{" "}
                  has gone back out across{" "}
                  <span className="tnum font-mono text-paper">{dispensed.count}</span>{" "}
                  {dispensed.count === 1 ? "grant" : "grants"}.
                </>
              )}
            </p>
          </div>

          {/* Right: the two steps that get SOL into someone's wallet. */}
          <div className="p-6 sm:p-8">
            <h2 className="t-label">Take a grant</h2>

            <form onSubmit={track} className="mt-4 flex flex-col gap-2.5 sm:flex-row">
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Your devnet address"
                spellCheck={false}
                aria-label="Your devnet address"
                className="min-w-0 flex-1 rounded-xl border border-edge bg-ink px-4 py-3 font-mono text-sm text-paper transition-colors placeholder:text-mist/60 focus:border-sky"
              />
              <button
                type="submit"
                className="brand-gradient shrink-0 rounded-xl px-5 py-3 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
              >
                {tracked ? "Update" : "Continue"}
              </button>
            </form>

            <AnimatePresence>
              {tracked && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-2.5 text-xs text-mist"
                >
                  Paying{" "}
                  <span className="font-mono text-paper">
                    {tracked.slice(0, 4)}…{tracked.slice(-4)}
                  </span>
                  . Held in this browser only.{" "}
                  <button
                    onClick={forget}
                    className="underline decoration-edge underline-offset-4 transition-colors hover:text-paper"
                  >
                    Forget it
                  </button>
                </motion.p>
              )}
            </AnimatePresence>

            <div className="mt-6 border-t border-edge pt-6">
              <p className="text-sm text-mist">
                {tracked
                  ? "Pick a size. One grant per address every eight hours."
                  : "Enter an address above and the sizes below become live."}
              </p>

              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-3">
                {tiers.map((t) => {
                  const short =
                    treasury?.affordableTier != null && t > treasury.affordableTier;
                  const off =
                    !tracked || !treasury?.canDispense || short || asking !== null;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => ask(t)}
                      disabled={off}
                      className="tnum rounded-xl border border-edge bg-ink px-3 py-3 font-mono text-sm transition-all enabled:hover:-translate-y-0.5 enabled:hover:border-aqua enabled:hover:text-aqua disabled:opacity-30"
                      title={short ? "More than the treasury can cover right now" : undefined}
                    >
                      {asking === t ? "sending" : t}
                    </button>
                  );
                })}
              </div>

              {tracked && !treasury?.canDispense && !treasury?.error && (
                <p className="mt-3 text-xs leading-relaxed text-mist">
                  {treasury && !treasury.signerReady
                    ? "The dispenser has no signing key configured, so nothing can be sent."
                    : "Nothing to hand out yet. The account fills from the faucets, which are refusing us too — the board below says which one is closest to paying."}
                </p>
              )}

              {grantError && (
                <p role="status" className="mt-3 text-xs text-rose-300">
                  {grantError}
                </p>
              )}

              {grant && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="status"
                  className="mt-3 rounded-xl border border-aqua/30 bg-aqua/5 px-3.5 py-2.5 text-xs text-aqua"
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
              )}
            </div>
          </div>
        </div>
      </section>

      {/* -----------------------------------------------------------------
          The upstreams. Diagnostics, not a checklist.
          ----------------------------------------------------------------- */}
      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="t-label">Upstream faucets</h2>
          <p className="text-xs text-mist">
            What each one did on its last check, and how long ago that was.
          </p>
        </div>

        <ul className="mt-5 grid gap-4 lg:grid-cols-2">
          {(rows ?? []).map((f, i) => {
            const ready = f.yourNextEligibleAt !== null && f.yourNextEligibleAt <= Date.now();
            return (
              <motion.li
                key={f.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.24 }}
                className="lift flex flex-col rounded-2xl border border-edge p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${DOT[f.health.status]} ${
                          f.health.status === "flowing" ? "pulse-dot" : ""
                        }`}
                      />
                      <h3 className="font-medium text-paper">{f.label}</h3>
                      <span className="font-mono text-xs text-mist">{LABEL[f.health.status]}</span>
                    </div>
                    <p className="mt-2.5 text-sm leading-relaxed text-mist">{f.note}</p>
                    <p className="mt-2.5 text-xs text-mist">
                      {f.health.sample > 0 ? (
                        <>
                          <span className="tnum font-mono text-paper">
                            {f.health.successRate === null
                              ? "—"
                              : `${Math.round(f.health.successRate * 100)}%`}
                          </span>{" "}
                          paid out across{" "}
                          <span className="tnum font-mono text-paper">{f.health.sample}</span> recent
                          {f.health.sample === 1 ? " report" : " reports"}
                        </>
                      ) : (
                        "No reports in the last 90 minutes"
                      )}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="tnum font-mono text-sm text-paper">~{f.expectedSol} SOL</p>
                    <p className="mt-0.5 text-xs text-mist">every {hours(f.cooldownMs)}</p>
                    {tracked && f.yourNextEligibleAt !== null && (
                      <p className="mt-2 text-xs text-mist">
                        you: <Countdown to={f.yourNextEligibleAt} />
                      </p>
                    )}
                  </div>
                </div>

                {/* A faucet you can open and a faucet that is called for you are
                    different things, and only one of them has a page. The two
                    server rows carry an API reference in claimUrl — the endpoint
                    Spigot posts to — because there is nothing else to point at.
                    Rendering that behind a button reading "Open faucet" sent
                    people to the requestAirdrop documentation and left them
                    looking for a claim form that does not exist. So the button
                    belongs to the rows a person can actually use. */}
                <div className="mt-5 border-t border-edge pt-4">
                  {f.access === "human" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={f.claimUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                          ready || !tracked
                            ? "border border-edge text-paper hover:border-mist"
                            : "border border-edge text-mist hover:text-paper"
                        }`}
                      >
                        {tracked && !ready ? "Open anyway" : "Open it yourself"}
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
                  ) : (
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <p className="text-xs leading-relaxed text-mist">
                        Nothing to click. Spigot calls this one itself every {hours(f.cooldownMs)}{" "}
                        and whatever it is given lands in the shared account.
                      </p>
                      <a
                        href={f.claimUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-xs text-mist underline decoration-edge underline-offset-4 transition-colors hover:text-paper"
                      >
                        See the endpoint it calls
                      </a>
                    </div>
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

        {rows === null && <p className="mt-5 text-sm text-mist">Reading the board…</p>}
      </section>

      {/* -----------------------------------------------------------------
          Volunteering. Folded away on purpose.

          Two upstreams sit behind a sign-in and a human check, so no schedule
          can reach them honestly — a person can, once, as themselves. That is
          worth offering and it is not worth leading with. Open by default it
          turned the page into a request; closed, it is a door for the one
          reader in fifty who wants to hold it open for the rest.
          ----------------------------------------------------------------- */}
      {treasury && humanRows.length > 0 && (
        <details className="group rounded-2xl border border-edge bg-panel/40 open:bg-panel/60">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5">
            <div className="min-w-0">
              <h2 className="t-h3 text-paper">Optional: top the account up by hand</h2>
              <p className="mt-1.5 text-sm text-mist">
                For the two faucets a schedule cannot reach. Nobody has to do this to get a grant.
              </p>
            </div>
            <span
              aria-hidden
              className="shrink-0 text-mist transition-transform duration-200 group-open:rotate-45"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
          </summary>

          <div className="border-t border-edge px-6 pb-6 pt-5">
            <p className="max-w-2xl text-sm leading-relaxed text-mist">
              Opening one of these is not enough on its own. The address below has to end up in its
              recipient field, or the SOL lands somewhere that is not this account.
            </p>

            <ol className="mt-5 space-y-4">
              <li className="flex gap-3">
                <span className="tnum shrink-0 font-mono text-xs text-sky">1</span>
                <div className="min-w-0">
                  <p className="text-sm text-mist">Copy the treasury address.</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <code className="min-w-0 break-all rounded-lg border border-edge bg-ink px-2.5 py-1.5 font-mono text-xs text-paper">
                      {treasury.address}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyAddress(treasury.address)}
                      className="shrink-0 rounded-lg border border-edge px-3 py-1.5 text-xs text-mist transition-colors hover:border-aqua hover:text-aqua"
                    >
                      {copied === "address" ? "copied" : "Copy"}
                    </button>
                  </div>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="tnum shrink-0 font-mono text-xs text-sky">2</span>
                <div className="min-w-0">
                  <p className="text-sm leading-relaxed text-mist">
                    Open a faucet and{" "}
                    <span className="text-paper">paste that address as the recipient</span>. Leaving
                    your own address in the field sends the SOL to you, not here — which is fine,
                    but it does not fill the dispenser.
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {humanRows.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => helpFill(r.id, r.claimUrl, treasury.address)}
                        className="rounded-lg border border-edge px-3.5 py-2 text-xs transition-colors hover:border-aqua hover:text-aqua"
                      >
                        {copied === r.id ? "copied — now paste it there" : `Open ${r.label}`}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-mist">
                    faucet.solana.com asks for a GitHub sign-in first and grants up to 5 SOL.
                    QuickNode grants 1 SOL and wants the address to hold a mainnet balance, which
                    this one does not, so it will likely refuse.
                  </p>
                </div>
              </li>

              <li className="flex gap-3">
                <span className="tnum shrink-0 font-mono text-xs text-sky">3</span>
                <p className="text-sm leading-relaxed text-mist">
                  Watch the balance on the left. It re-reads devnet every twenty seconds, so a grant
                  that landed shows up on its own within a minute. If it does not move, the faucet
                  refused — that is its answer, not a fault here.
                </p>
              </li>
            </ol>

            <p className="mt-5 max-w-2xl text-xs leading-relaxed text-mist">
              Both faucets count against the <em>receiving</em> address, not against you. So the
              first person through each window fills the account and everyone after is refused —
              more volunteers does not mean more SOL, and clicking twice does not help. Come back
              tomorrow instead.
            </p>
          </div>
        </details>
      )}
    </div>
  );
}

/** One label-and-figure row in the capacity readout. */
function Line({
  label,
  value,
  quiet = false,
}: {
  label: string;
  value: string;
  quiet?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-xs text-mist">{label}</dt>
      <dd className={`tnum font-mono text-sm ${quiet ? "text-mist" : "text-paper"}`}>{value}</dd>
    </div>
  );
}
