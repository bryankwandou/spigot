"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

/**
 * One entrance, used everywhere.
 *
 * Every section on this page arrives the same way — a short rise out of a blur
 * — because a page where each block has its own idea of how to appear reads as
 * a demo reel rather than a product. It fires once, at 18% of the viewport, so
 * scrolling back up does not replay the whole page.
 *
 * It is built out of a class toggle rather than an animation library on
 * purpose. The obvious version renders every section at `opacity: 0` and waits
 * for script to raise it, which means the entire page below the console is
 * blank to anything that does not run JavaScript — a crawler, a reader with
 * script blocked, a bundle that failed to load. Here the hidden state is only
 * ever applied by script (`.js` is set on the root before first paint), so the
 * failure mode is a page that appears without animating instead of a page that
 * does not appear.
 *
 * Under `prefers-reduced-motion` the stylesheet keeps everything visible and
 * still. Not a faster animation: none.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // No observer means no way to know when this scrolled in. Show it rather
    // than leave it hidden forever.
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("in");
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.18 },
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal${className ? ` ${className}` : ""}`}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
