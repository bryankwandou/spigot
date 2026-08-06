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
  title: "Spigot — Devnet SOL on tap",
  description:
    "One endpoint for Solana devnet funding. Spigot asks each upstream faucet on its own published schedule, holds what it receives in a public treasury, and hands it out on request.",
  openGraph: {
    title: "Spigot — Devnet SOL on tap",
    description:
      "One endpoint for Solana devnet funding, with every request and payout visible on-chain.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#080b14",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
