import { Mark } from "./Mark";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Live board", href: "#board" },
      { label: "How it works", href: "#how" },
      { label: "Limits", href: "#limits" },
    ],
  },
  {
    title: "Read",
    links: [
      { label: "FAQ", href: "#faq" },
      { label: "Source", href: "https://github.com/bryankwandou/spigot" },
      { label: "Status endpoint", href: "/api/status" },
    ],
  },
  {
    title: "Upstream",
    links: [
      { label: "faucet.solana.com", href: "https://faucet.solana.com" },
      { label: "QuickNode faucet", href: "https://faucet.quicknode.com/solana/devnet" },
      { label: "Solana docs", href: "https://solana.com/docs" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-32 border-t border-edge">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-2.5">
              <Mark size={22} id="footer" />
              <span className="text-base font-semibold tracking-[-0.03em] text-paper">Spigot</span>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-mist">
              Devnet SOL on tap. One relay that respects every published cooldown, so you stop
              keeping four of them in your head.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="t-label">{col.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-sm text-mist transition-colors hover:text-aqua"
                      {...(l.href.startsWith("http")
                        ? { target: "_blank", rel: "noreferrer noopener" }
                        : {})}
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <hr className="rule my-10" />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-mist">
            Spigot — devnet infrastructure. Not affiliated with Solana Labs or the Solana
            Foundation.
          </p>
          <p className="font-mono text-xs text-mist">Solana devnet only. No mainnet value.</p>
        </div>
      </div>
    </footer>
  );
}
