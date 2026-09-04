"use client";

import { useEffect, useState } from "react";
import { Wordmark } from "./Mark";

const LINKS = [
  { href: "#board", label: "Live board" },
  { href: "#how", label: "How it works" },
  { href: "#limits", label: "Limits" },
  { href: "#faq", label: "FAQ" },
];

/**
 * The bar stays; its background only arrives once there is content behind it
 * to separate from. Over the hero it is invisible, which keeps the first
 * screen a single image instead of a strip and a picture.
 */
export function Nav() {
  const [past, setPast] = useState(false);

  useEffect(() => {
    const onScroll = () => setPast(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        past ? "glass border-b border-edge" : "border-b border-transparent"
      }`}
    >
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 transition-all duration-300 sm:px-8 ${
          past ? "h-14" : "h-[4.5rem]"
        }`}
      >
        <a href="#top" className="shrink-0" aria-label="Spigot, back to top">
          <Wordmark />
        </a>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Sections">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-mist transition-colors hover:text-paper"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <a
            href="https://github.com/bryankwandou/spigot"
            target="_blank"
            rel="noreferrer noopener"
            className="hidden text-sm text-mist transition-colors hover:text-paper sm:block"
          >
            Source
          </a>
          <a
            href="#board"
            className="brand-gradient rounded-full px-4 py-2 text-sm font-semibold text-ink transition-opacity hover:opacity-90"
          >
            Get devnet SOL
          </a>
        </div>
      </div>
    </header>
  );
}
