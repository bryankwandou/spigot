"use client";

import { useEffect, useState } from "react";

function format(ms: number): string {
  if (ms <= 0) return "ready";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

/**
 * Ticks once a second toward a target timestamp.
 *
 * The first render deliberately matches the server output ("—") and the real
 * value only appears after mount, because a clock rendered on the server is
 * wrong by the time it reaches the browser and React will say so.
 */
export function Countdown({ to }: { to: number }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (now === null) return <span className="tnum text-mist">—</span>;

  const left = to - now;
  const ready = left <= 0;

  return (
    <span className={`tnum ${ready ? "text-aqua" : "text-paper"}`}>{format(left)}</span>
  );
}
