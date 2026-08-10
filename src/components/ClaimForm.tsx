"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Result =
  | { kind: "paid"; sol: number; signature: string; explorer: string }
  | { kind: "error"; message: string };

/**
 * Draw from the pool.
 *
 * The address is prefilled from whatever the board is already tracking, so a
 * developer types it once for the whole page rather than once per widget.
 */
export function ClaimForm() {
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("spigot.address");
    if (saved) setAddress(saved);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const a = address.trim();
    if (!a || busy) return;

    setBusy(true);
    setResult(null);
    window.localStorage.setItem("spigot.address", a);

    try {
      const r = await fetch("/api/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: a }),
      });
      const j = await r.json();
      setResult(
        r.ok
          ? { kind: "paid", sol: j.sol, signature: j.signature, explorer: j.explorer }
          : { kind: "error", message: j.error ?? "That did not go through." },
      );
    } catch {
      setResult({ kind: "error", message: "Could not reach the pool." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
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
          disabled={busy}
          className="brand-gradient rounded-lg px-5 py-3 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Sending" : "Draw 1 SOL"}
        </button>
      </form>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={result.kind + (result.kind === "paid" ? result.signature : result.message)}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="mt-4 rounded-lg border border-edge bg-panel p-4 text-sm"
          >
            {result.kind === "paid" ? (
              <p className="text-paper">
                <span className="tnum">{result.sol}</span> SOL sent.{" "}
                <a
                  href={result.explorer}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-aqua underline decoration-edge underline-offset-4"
                >
                  View the transaction
                </a>
              </p>
            ) : (
              <p className="text-mist">{result.message}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <p className="mt-3 text-xs text-mist">
        One SOL per request, five per address per day. Free, and filled by hand — if it is empty,
        the board below shows which faucet is paying instead.
      </p>
    </div>
  );
}
