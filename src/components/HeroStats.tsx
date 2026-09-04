"use client";

import { useEffect, useState } from "react";
import { Countdown } from "./Countdown";

type Snapshot = {
  treasury: { sol: number | null } | null;
  dispensed: { count: number; sol: number } | null;
  scheduler: { dueAt: number | null } | null;
  faucets: Array<{ health: { status: string } }> | null;
};

/**
 * Four figures under the headline, all of them read rather than asserted.
 *
 * Every one of these is a number the page can be held to: the balance comes
 * off devnet, the grant count off the payout log, the flowing count off the
 * last probe of each upstream. None of them is a marketing figure and none is
 * padded — when the account is empty this strip says 0.000 SOL in the same
 * type size it would say anything else.
 */
export function HeroStats() {
  const [snap, setSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/status", { cache: "no-store" });
        const j = await r.json();
        if (alive) setSnap(j);
      } catch {
        /* keep the last good reading rather than blanking the strip */
      }
    };
    load();
    const id = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const flowing = snap?.faucets?.filter((f) => f.health.status === "flowing").length ?? null;
  const total = snap?.faucets?.length ?? 4;

  const cells: Array<{ label: string; body: React.ReactNode }> = [
    {
      label: "In the account",
      body:
        snap?.treasury?.sol === null || snap?.treasury == null ? (
          <Pending />
        ) : (
          <>
            {snap.treasury.sol.toFixed(3)} <Unit>SOL</Unit>
          </>
        ),
    },
    {
      label: "Handed out",
      body: snap?.dispensed ? (
        <>
          {snap.dispensed.sol.toFixed(2)} <Unit>SOL</Unit>
        </>
      ) : (
        <Pending />
      ),
    },
    {
      label: "Upstreams paying",
      body:
        flowing === null ? (
          <Pending />
        ) : (
          <>
            {flowing}
            <Unit>/{total}</Unit>
          </>
        ),
    },
    {
      label: "Next scheduled ask",
      body: snap?.scheduler?.dueAt ? <Countdown to={snap.scheduler.dueAt} /> : <Pending />,
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-edge bg-edge sm:grid-cols-4">
      {cells.map((c) => (
        <div key={c.label} className="bg-panel px-4 py-4 sm:px-5">
          <dt className="t-label">{c.label}</dt>
          <dd className="tnum mt-2 font-mono text-lg text-paper sm:text-xl">{c.body}</dd>
        </div>
      ))}
    </dl>
  );
}

function Unit({ children }: { children: React.ReactNode }) {
  return <span className="text-sm text-mist">{children}</span>;
}

/* A dash, not a zero. A figure that has not been read yet and a figure that was
   read as nothing are different facts and should not look the same. */
function Pending() {
  return <span className="text-mist">—</span>;
}
