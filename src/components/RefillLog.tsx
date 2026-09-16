"use client";

import { useEffect, useState } from "react";
import { useLang } from "./Lang";

type Entry = {
  faucetId: string;
  at: number;
  outcome: "granted" | "rate_limited" | "dry" | "failed";
  source: "probe" | "report";
  said: string | null;
};

/**
 * The refill log: every ask of the last day, in the upstream's own words.
 *
 * The board above says "dry" and asks to be believed. This does not. It shows
 * the sentence the faucet answered with and the minute it said it, so a reader
 * can tell three things apart that otherwise look identical from outside: a
 * faucet that refused, a scheduler that never ran, and a deployment quietly
 * failing to call anything at all. The last of those has happened here before.
 *
 * It is deliberately plain. Refusals are the normal case on devnet, so a wall
 * of red would be alarm without information; the outcome is a word and a dot,
 * and the evidence is the quoted text.
 */
export function RefillLog() {
  const { t } = useLang();
  const [log, setLog] = useState<Entry[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [err, setErr] = useState(false);
  const [all, setAll] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        setLog(Array.isArray(d.log) ? d.log : []);
        // The log stores faucet ids because that is what is stable. A reader
        // should still see the provider's name rather than our slug for it.
        const f: Array<{ id: string; label: string }> = Array.isArray(d.faucets) ? d.faucets : [];
        setNames(Object.fromEntries(f.map((x) => [x.id, x.label])));
      })
      .catch(() => live && setErr(true));
    return () => {
      live = false;
    };
  }, []);

  if (err) return <p className="text-sm text-mist">{t.log.unreachable}</p>;
  if (log === null) return <p className="text-sm text-mist">{t.log.loading}</p>;
  if (log.length === 0) return <p className="text-sm text-mist">{t.log.empty}</p>;

  const granted = log.filter((e) => e.outcome === "granted").length;
  const shown = all ? log : log.slice(0, 8);

  return (
    <div>
      <p className="text-sm leading-relaxed text-mist">
        {t.log.counted(log.length, granted)}
      </p>

      <ol className="mt-8 space-y-px overflow-hidden rounded-2xl border border-edge bg-edge">
        {shown.map((e) => (
          <li key={`${e.faucetId}-${e.at}`} className="bg-ink p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span
                aria-hidden
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  e.outcome === "granted" ? "bg-aqua" : "bg-edge"
                }`}
              />
              <span className="t-h3 text-paper">{names[e.faucetId] ?? e.faucetId}</span>
              <span className="text-xs text-mist">{t.log.outcomes[e.outcome]}</span>
              <time
                dateTime={new Date(e.at).toISOString()}
                className="tnum ml-auto font-mono text-xs text-mist"
              >
                {new Date(e.at).toISOString().slice(0, 16).replace("T", " ")} UTC
              </time>
            </div>

            {e.said === null ? (
              <p className="mt-3 text-sm text-mist">{t.log.noWords}</p>
            ) : e.outcome === "granted" ? (
              // A grant records a transaction signature, not a sentence. That
              // signature is the strongest evidence on this page and the only
              // line here that can be checked against the chain rather than
              // against us, so it is a link and not a wall of monospace.
              <a
                href={`https://explorer.solana.com/tx/${encodeURIComponent(e.said)}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 block break-all font-mono text-xs leading-relaxed text-aqua underline decoration-aqua/40 underline-offset-4 transition-colors hover:decoration-aqua"
                title={t.log.onChain}
              >
                {e.said}
              </a>
            ) : (
              <p className="mt-3 overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-mist">
                {e.said}
              </p>
            )}
          </li>
        ))}
      </ol>

      {log.length > shown.length && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="mt-6 rounded-full border border-edge px-5 py-2.5 text-sm text-mist transition-colors hover:border-mist hover:text-paper"
        >
          {t.log.more(log.length - shown.length)}
        </button>
      )}
    </div>
  );
}
