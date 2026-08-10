import { NextResponse } from "next/server";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { probeable, isEligible, nextEligibleAt } from "@/lib/faucets";
import { migrate, lastProbeAt, recordProbe, isConfigured, type Outcome } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

/**
 * The scheduled probe.
 *
 * One request per faucet per cooldown window, from one throwaway address, from
 * one host. The point is not to collect SOL — the probe address is discarded
 * and whatever lands there stays there. The point is to find out, on the
 * community's behalf, whether the faucet is paying anyone right now, so that
 * nobody else has to burn their own daily allowance discovering it.
 *
 * Anything still inside its window is reported as skipped and not touched.
 */
export async function POST(req: Request) {
  const token = process.env.RELAY_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "RELAY_TOKEN is not configured." }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // The probe log is also the cooldown clock. Without it there is no record of
  // when we last asked, and probing anyway would risk going in early — exactly
  // the mistake the margin exists to prevent. Stand down instead.
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "No database, so the cooldown clock is unreadable. Nothing probed." },
      { status: 503 },
    );
  }

  await migrate();

  const now = Date.now();
  const conn = new Connection(RPC, "confirmed");
  const probed: Array<{ faucetId: string; outcome: Outcome; detail: string | null }> = [];
  const skipped: Array<{ faucetId: string; readyAt: number }> = [];

  for (const f of probeable()) {
    const last = await lastProbeAt(f.id);
    if (!isEligible(f, last, now)) {
      skipped.push({ faucetId: f.id, readyAt: nextEligibleAt(f, last) });
      continue;
    }

    let outcome: Outcome = "failed";
    let detail: string | null = null;

    try {
      const probe = Keypair.generate();
      const sig = await conn.requestAirdrop(probe.publicKey, LAMPORTS_PER_SOL);
      const bh = await conn.getLatestBlockhash();
      await conn.confirmTransaction({ signature: sig, ...bh }, "confirmed");
      outcome = "granted";
      detail = sig;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const dry = /run dry|airdrop limit|429|Too Many Requests/i.test(msg);
      outcome = dry ? "dry" : "failed";
      detail = msg.split("\n")[0].slice(0, 300);
    }

    await recordProbe(f.id, outcome, detail);
    probed.push({ faucetId: f.id, outcome, detail });
  }

  return NextResponse.json({ checkedAt: now, probed, skipped });
}
