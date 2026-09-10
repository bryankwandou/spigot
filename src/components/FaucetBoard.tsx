"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
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
 * Diagnostics, not the way in. Getting SOL happens in the console one screen
 * up; what happens here is the question that console cannot answer on the day
 * the account runs dry — which upstream is worth knocking on, and how stale
 * that verdict is.
 *
 * Two questions get answered per row and they are different questions: is this
 * faucet paying anyone at all right now, and are *you* allowed to ask it yet.
 * A faucet can be flowing and still closed to you, which is precisely the
 * information that four browser tabs fail to give you.
 */
export function FaucetBoard() {
  const [tracked, setTracked] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [scheduler, setScheduler] = useState<Scheduler | null>(null);
  const [treasury, setTreasury] = useState<Treasury | null>(null);
  const [dispensed, setDispensed] = useState<{ count: number; sol: number } | null>(null);
  const [capacity, setCapacity] = useState<Capacity | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Keyed by faucet so a rejection appears against the row it belongs to.
  const [notice, setNotice] = useState<{ faucetId: string; text: string } | null>(null);

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

  /**
   * Hand a volunteer the treasury address and the faucet, and get out of the way.
   *
   * This is the one place the community can add supply that no schedule can
   * reach: the two web faucets sit behind a sign-in and a human check, which an
   * automated probe cannot honestly pass. A person can, once, as themselves.
   *
   * What it deliberately does not do is pretend that more clicks mean more SOL.
   * Both of these meter on the receiving address, so the first volunteer of the
   * window fills the account and everyone after is refused.
   */
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

  // The address belongs to the console, not to this board. Reading it here
  // rather than asking for it a second time is the difference between one
  // form on the page and two that disagree.
  useEffect(() => {
    const read = () => setTracked(window.localStorage.getItem("spigot.address"));
    read();
    window.addEventListener("storage", read);
    const id = setInterval(read, 4000);
    return () => {
      window.removeEventListener("storage", read);
      clearInterval(id);
    };
  }, []);

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
        setNotice({ faucetId, text: body?.error ?? "That report was not recorded." });
        return;
      }

      await load(tracked);
    } catch {
      setNotice({ faucetId, text: "Could not reach the board. Your report was not saved." });
    } finally {
      setBusy(null);
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
          The upstreams. What the console cannot tell you.
          ----------------------------------------------------------------- */}
      <section>
        <ul className="grid gap-4 lg:grid-cols-2">
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
                        className="rounded-lg border border-edge px-3.5 py-2 text-sm font-medium text-mist transition-colors hover:border-mist hover:text-paper"
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

        {rows === null && <p className="text-sm text-mist">Reading the board…</p>}
      </section>

      {/* -----------------------------------------------------------------
          What the account can actually cover. A balance alone does not answer
          "will it pay me, and if not, when", which is the only question
          somebody who just saw a refusal has.
          ----------------------------------------------------------------- */}
      {treasury && capacity && (
        <section className="lift rounded-2xl border border-edge p-6 sm:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="t-label">Account capacity</h3>
            <a
              href={treasury.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-mist underline decoration-edge underline-offset-4 transition-colors hover:text-paper"
            >
              {treasury.address.slice(0, 6)}…{treasury.address.slice(-6)}
            </a>
          </div>

          <dl className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <Line label="Ready to hand out" value={`${capacity.spendableSol.toFixed(3)} SOL`} />
            <Line label="Grants left at 0.1 SOL" value={String(capacity.maxGrants)} />
            <Line label="Refills at most" value={`${capacity.dailyCeilingSol.toFixed(1)} SOL/day`} />
            <Line label="Held back for fees" value={`${capacity.reservedSol.toFixed(2)} SOL`} quiet />
          </dl>

          {capacity.maxGrants === 0 && capacity.daysToFillLargestTier !== null && (
            <p className="mt-5 max-w-2xl text-xs leading-relaxed text-mist">
              Empty right now. At the published rates a full 3 SOL tier is about{" "}
              <span className="tnum font-mono text-paper">
                {capacity.daysToFillLargestTier.toFixed(1)}
              </span>{" "}
              days of collecting away — and that is a ceiling, not a forecast. It assumes every ask
              is granted, and most are refused.
            </p>
          )}

          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-mist">
            {treasury.error
              ? "The balance could not be read just now. The address above is still the one being filled."
              : "Read from devnet, not from our own log."}
            {dispensed && dispensed.count > 0 && (
              <>
                {" "}
                <span className="tnum font-mono text-paper">{dispensed.sol.toFixed(2)} SOL</span> has
                gone back out across{" "}
                <span className="tnum font-mono text-paper">{dispensed.count}</span>{" "}
                {dispensed.count === 1 ? "grant" : "grants"}.
              </>
            )}
          </p>
        </section>
      )}

      {/* -----------------------------------------------------------------
          Volunteering. Folded away on purpose.

          Two upstreams sit behind a sign-in and a human check, so no schedule
          can reach them honestly — a person can, once, as themselves. That is
          worth offering and it is not worth leading with. Open by default it
          turned the page into a request; closed, it is a door for the one
          reader in fifty who wants to hold it open for the rest.
          ----------------------------------------------------------------- */}
      {treasury && humanRows.length > 0 && (
        <details className="group rounded-2xl border border-edge bg-panel/40">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5">
            <div className="min-w-0">
              <h3 className="t-h3 text-paper">Optional: top the account up by hand</h3>
              <p className="mt-1.5 text-sm text-mist">
                For the two faucets a schedule cannot reach. Nobody has to do this to get a grant.
              </p>
            </div>
            <span
              aria-hidden
              className="shrink-0 text-mist transition-transform duration-200 group-open:rotate-45"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
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
                  Watch the balance in the console at the top. It re-reads devnet every twenty
                  seconds, so a grant that landed shows up on its own within a minute. If it does
                  not move, the faucet refused — that is its answer, not a fault here.
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
function Line({ label, value, quiet = false }: { label: string; value: string; quiet?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-edge pb-2.5">
      <dt className="text-xs text-mist">{label}</dt>
      <dd className={`tnum font-mono text-sm ${quiet ? "text-mist" : "text-paper"}`}>{value}</dd>
    </div>
  );
}
