"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

type Status = {
  treasury: { address: string | null; lamports: number | null };
};

const LAMPORTS = 1_000_000_000;

/**
 * The pool, stated plainly.
 *
 * A funding page that does not show its own balance is asking to be trusted.
 * This one shows the address so anyone can check the number against an
 * explorer and catch us if it disagrees.
 */
export function PoolStatus() {
  const [s, setS] = useState<Status | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch("/api/status", { cache: "no-store" });
        setS(await r.json());
      } catch {
        /* keep the last known figure rather than flashing an error */
      }
    };
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, []);

  const addr = s?.treasury?.address ?? null;
  const lamports = s?.treasury?.lamports ?? null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
      className="flex flex-wrap items-baseline gap-x-6 gap-y-2 rounded-xl border border-edge bg-panel px-5 py-4"
    >
      <div>
        <p className="text-xs text-mist">In the pool</p>
        <p className="tnum mt-0.5 text-2xl font-semibold text-paper">
          {lamports === null ? "—" : (lamports / LAMPORTS).toFixed(2)}{" "}
          <span className="text-base font-normal text-mist">SOL</span>
        </p>
      </div>

      <div className="min-w-0">
        <p className="text-xs text-mist">Treasury address</p>
        {addr ? (
          <a
            href={`https://explorer.solana.com/address/${addr}?cluster=devnet`}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-0.5 block truncate font-mono text-sm text-sky underline decoration-edge underline-offset-4"
          >
            {addr}
          </a>
        ) : (
          <p className="mt-0.5 font-mono text-sm text-mist">not configured yet</p>
        )}
      </div>
    </motion.div>
  );
}
