import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-stack",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Spigot — which devnet faucet paid last",
  description:
    "A health board for Solana devnet faucets. Spigot probes each one on its own published schedule, pools what developers report, and prints the age of every verdict so you can tell fresh from stale.",
  openGraph: {
    title: "Spigot — which devnet faucet paid last",
    description:
      "Whether each Solana devnet faucet paid or refused on the last check, and how long ago that check was.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#080b14",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <head>
        {/* Marks the document as scripted before first paint, which is what
            lets the scroll reveals default to visible. Without this a failed
            bundle would leave every section below the console blank; with it,
            the worst case is a page that simply appears. */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
