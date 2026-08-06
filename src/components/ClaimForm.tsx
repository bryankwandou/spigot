"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Result =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "done"; sol: number; signature: string; explorer: string }
  | { kind: "error"; message: string };

export function ClaimForm() {
  const [address, setAddress] = useState("");
  const [result, setResult] = useState<Result>({ kind: "idle" });

  const busy = result.kind === "working";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    setResult({ kind: "working" });
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setResult({ kind: "error", message: data.error ?? "The request did not go through." });
        return;
      }
      setResult({ kind: "done", sol: data.sol, signature: data.signature, explorer: data.explorer });
    } catch {
      setResult({ kind: "error", message: "Could not reach Spigot. Check your connection." });
    }
  }

  return (
    <div className="w-full max-w-xl">
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="addr" className="sr-only">
          Your devnet address
        </label>
        <input
          id="addr"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Paste a devnet address"
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-xl border border-edge bg-panel px-4 py-3.5 font-mono text-sm text-paper placeholder:text-mist/60 transition-colors focus:border-sky"
        />
        <button
          type="submit"
          disabled={busy || address.trim().length === 0}
          className="brand-gradient rounded-xl px-6 py-3.5 text-sm font-semibold text-ink transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Sending" : "Send 1 SOL"}
        </button>
      </form>

      <AnimatePresence mode="wait">
        {result.kind === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 rounded-xl border border-aqua/25 bg-aqua/5 px-4 py-3 text-sm"
          >
            <p className="text-paper">{result.sol} SOL is on its way.</p>
            <a
              href={result.explorer}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block truncate font-mono text-xs text-sky underline underline-offset-4"
            >
              {result.signature}
            </a>
          </motion.div>
        )}

        {result.kind === "error" && (
          <motion.p
            key="error"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 rounded-xl border border-rose-500/25 bg-rose-500/5 px-4 py-3 text-sm text-rose-200"
          >
            {result.message}
          </motion.p>
        )}
      </AnimatePresence>

      <p className="mt-3 text-xs text-mist">
        One SOL per request, five per address per day. Devnet only — these tokens have no value.
      </p>
    </div>
  );
}
