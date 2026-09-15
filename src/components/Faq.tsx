"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLang } from "./Lang";

export function Faq() {
  const { t } = useLang();
  const [open, setOpen] = useState<number | null>(0);
  const QA = t.faq.items;

  return (
    <ul className="mt-10 border-t border-edge">
      {QA.map((item, i) => {
        const isOpen = open === i;
        return (
          <li key={item.q} className="border-b border-edge">
            <h3>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="group flex w-full items-start gap-4 py-5 text-left"
              >
                <span className="tnum mt-0.5 shrink-0 font-mono text-xs text-sky">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={`t-h3 min-w-0 flex-1 transition-colors ${
                    isOpen ? "text-paper" : "text-mist group-hover:text-paper"
                  }`}
                >
                  {item.q}
                </span>
                <span
                  aria-hidden
                  className={`mt-1 shrink-0 text-mist transition-transform duration-200 ${
                    isOpen ? "rotate-45" : ""
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </span>
              </button>
            </h3>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <p className="max-w-2xl pb-6 pl-10 text-sm leading-relaxed text-mist">
                    {item.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}
