"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * One entrance, used everywhere.
 *
 * Every section on this page arrives the same way — a short rise out of a blur
 * — because a page where each block has its own idea of how to appear reads as
 * a demo reel rather than a product. It fires once, at 18% of the viewport, so
 * scrolling back up does not replay the whole page.
 *
 * With reduced motion requested it renders the content plainly. Not a faster
 * animation: none.
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
  const still = useReducedMotion();

  if (still) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 26, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.62, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
