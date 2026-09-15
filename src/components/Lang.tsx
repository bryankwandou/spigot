"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { COPY, pickLang, type Copy, type Lang } from "@/lib/copy";

type Ctx = { lang: Lang; t: Copy; setLang: (l: Lang) => void };

/**
 * English is the server's guess and the crawler's view.
 *
 * The real choice needs `localStorage` and `navigator.languages`, neither of
 * which exists during the render that produces the HTML. Picking on the client
 * after mount and swapping is the honest version of that: the alternative is
 * rendering nothing until the language is known, which trades a flash of the
 * wrong language for a flash of no page at all.
 */
const LangContext = createContext<Ctx>({ lang: "en", t: COPY.en, setLang: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem("spigot.lang");
    const next = pickLang(saved, navigator.languages ?? [navigator.language]);
    setLangState(next);
  }, []);

  // Keep the document's own language honest. A screen reader picks its
  // pronunciation from this attribute, so leaving it at `en` while the page
  // reads Indonesian makes the page actively harder to listen to.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem("spigot.lang", l);
    } catch {
      // Storage refused. The choice still applies for this visit, which is the
      // part the reader actually asked for.
    }
  }, []);

  return (
    <LangContext.Provider value={{ lang, t: COPY[lang], setLang }}>{children}</LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}

/**
 * The switch itself.
 *
 * Two languages, so this is a toggle rather than a menu: a select holding two
 * options costs a click to discover what a button can just say. It shows the
 * language you would be switching *to*, because a control labelled with the
 * state you are already in is the classic way to make people press it twice.
 */
export function LangToggle({ className }: { className?: string }) {
  const { lang, t, setLang } = useLang();
  const other: Lang = lang === "en" ? "id" : "en";

  return (
    <button
      type="button"
      onClick={() => setLang(other)}
      aria-label={t.langSwitchLabel}
      title={t.langSwitchLabel}
      className={`tnum rounded-full border border-edge px-2.5 py-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-mist transition-colors hover:border-mist hover:text-paper ${className ?? ""}`}
    >
      <span className={lang === "en" ? "text-paper" : undefined}>EN</span>
      <span aria-hidden className="mx-1 text-edge">
        /
      </span>
      <span className={lang === "id" ? "text-paper" : undefined}>ID</span>
    </button>
  );
}
