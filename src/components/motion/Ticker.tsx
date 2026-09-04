"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

/**
 * A number that counts up to itself once, when it first comes into view.
 *
 * Deliberately not a live-updating odometer. These are measured quantities —
 * a balance read off devnet, a count of grants — and animating them on every
 * refresh would make a figure that moved by nothing look like news.
 */
export function Ticker({
  value,
  decimals = 0,
  duration = 1100,
  className,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.6 });
  const still = useReducedMotion();
  const [shown, setShown] = useState(still ? value : 0);

  useEffect(() => {
    if (still) {
      setShown(value);
      return;
    }
    if (!seen) return;

    let raf = 0;
    const start = performance.now();
    const from = 0;

    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      // Ease out — fast at the front, settling rather than stopping dead.
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(from + (value - from) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [seen, value, duration, still]);

  return (
    <span ref={ref} className={className}>
      {shown.toFixed(decimals)}
    </span>
  );
}
