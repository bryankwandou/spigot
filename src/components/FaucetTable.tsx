"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Countdown } from "./Countdown";

type Faucet = {
  id: string;
  label: string;
  access: "server" | "human";
  cooldownMs: number;
  expectedSol: number;
  terms: string;
  lastAttempt: number | null;
  eligibleAt: number;
};

type Status = {
  ready: boolean;
  reason?: string;
  treasury?: string;
  treasuryLamports?: number;
  faucets: Faucet[];
};

const LAMPORTS = 1_000_000_000;

export function FaucetTable() {
  const [status, setStatus] = useState<Status | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        const data = (await res.json()) as Status;
        if (alive) {
          setStatus(data);
          setFailed(false);
        }
      } catch {
        if (alive) setFailed(true);
      }
    }

    load();
    const id = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (failed) {
    return <p className="text-sm text-mist">The status feed is unreachable right now.</p>;
  }

  if (!status) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl border border-edge bg-panel/60" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {status.ready ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-sm text-mist">Treasury holds</span>
          <span className="tnum text-2xl font-semibold text-paper">
            {((status.treasuryLamports ?? 0) / LAMPORTS).toFixed(3)}
          </span>
          <span className="text-sm text-mist">SOL</span>
          <a
            href={`https://explorer.solana.com/address/${status.treasury}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            className="ml-auto truncate font-mono text-xs text-sky underline underline-offset-4"
          >
            {status.treasury}
          </a>
        </div>
      ) : (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
          {status.reason}
        </p>
      )}

      <ul className="space-y-2">
        {status.faucets.map((f, i) => (
          <motion.li
            key={f.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-edge bg-panel px-4 py-3.5"
          >
            <div className="min-w-0 flex-1">
              <a
                href={f.terms}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-paper underline decoration-edge underline-offset-4 hover:decoration-sky"
              >
                {f.label}
              </a>
              <p className="mt-0.5 text-xs text-mist">
                {f.expectedSol} SOL every {Math.round(f.cooldownMs / 3_600_000)}h
                {f.access === "human" ? " — needs a person" : " — automated"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-mist">Next</p>
              <p className="text-sm">
                <Countdown to={f.eligibleAt} />
              </p>
            </div>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
