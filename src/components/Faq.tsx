"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const QA = [
  {
    q: "Do I have to visit a faucet at all?",
    a: "Not for the ordinary case. Paste an address into the console at the top of this page, pick a size, confirm — the dispenser signs a transfer out of the shared account and hands you back a transaction. The faucet-opening buttons further down exist for one job only: the two upstreams behind a sign-in cannot be called by a schedule, so when the account runs low a person can top it up by hand. That is a volunteer path, not the way you get funded.",
  },
  {
    q: "Where does the SOL come from?",
    a: "The same public faucets you would have opened yourself. Spigot calls the two that answer a program — the devnet RPC airdrop and a keyed Helius endpoint — on their own published windows, from one address, and parks what it receives in one account anyone can look up. Nothing is minted here and nothing is bought.",
  },
  {
    q: "Is this a way around the rate limits?",
    a: "No, and it would not work if it tried. The RPC airdrop meters the calling IP rather than the receiving wallet, so extra addresses buy nothing. One identity, one request per window, the published limit plus three minutes of headroom. The value is that you stop tracking four cooldown timers, not that more SOL exists.",
  },
  {
    q: "What happens when the account is empty?",
    a: "The board says so in plain words and points you at whichever upstream is most likely to pay right now. It does not queue you, it does not promise a refill time it cannot know, and it never shows a balance it has not read off devnet in the last twenty seconds.",
  },
  {
    q: "What does it cost?",
    a: "Nothing. No token, no fee, no tier, no mainnet wallet to connect. Devnet SOL is given away for free by design and putting a price on it would be selling something that was never ours.",
  },
  {
    q: "Do you want my private key?",
    a: "No. Pasting a public address is the entire interaction and even that is optional — the board reads fine without one. Nothing here asks for a seed phrase, a key, or a signature.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

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
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
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
