import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";

/**
 * The devnet treasury.
 *
 * The pool is filled by hand. That is not a limitation to apologise for — it
 * is the measured reality: the RPC airdrop meters on egress IP, so a hosted
 * job collects nothing no matter how many addresses it owns. Someone claims
 * from the human-gated faucets and forwards it here, and the app spreads that
 * across the developers who could not get through at all.
 *
 * The secret is read from the environment and from nowhere else. It is never
 * loaded from a file inside the repository, never logged, and never returned
 * by an endpoint. On Vercel it lives in project settings; locally it lives in
 * .env.local, which git ignores.
 */

export const DEVNET_RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

/** Left behind so the treasury can always pay its own transaction fees. */
export const FEE_FLOOR_LAMPORTS = 0.01 * LAMPORTS_PER_SOL;

export function isFunded(): boolean {
  return Boolean(process.env.SPIGOT_TREASURY_SECRET);
}

export function treasuryKeypair(): Keypair {
  const raw = process.env.SPIGOT_TREASURY_SECRET;
  if (!raw) throw new Error("SPIGOT_TREASURY_SECRET is not set.");

  let bytes: number[];
  try {
    bytes = JSON.parse(raw);
  } catch {
    throw new Error("SPIGOT_TREASURY_SECRET must be a JSON array of 64 bytes.");
  }
  if (!Array.isArray(bytes) || bytes.length !== 64) {
    throw new Error("SPIGOT_TREASURY_SECRET must contain exactly 64 bytes.");
  }

  const kp = Keypair.fromSecretKey(Uint8Array.from(bytes));

  // A mismatch here means the deployment is signing with a different wallet
  // than the one it publishes. Fail loudly rather than pay from a surprise.
  const declared = process.env.SPIGOT_TREASURY_ADDRESS;
  if (declared && declared !== kp.publicKey.toBase58()) {
    throw new Error("SPIGOT_TREASURY_SECRET does not match SPIGOT_TREASURY_ADDRESS.");
  }

  return kp;
}

export function treasuryAddress(): string | null {
  if (process.env.SPIGOT_TREASURY_ADDRESS) return process.env.SPIGOT_TREASURY_ADDRESS;
  if (!isFunded()) return null;
  try {
    return treasuryKeypair().publicKey.toBase58();
  } catch {
    return null;
  }
}

export function connection(): Connection {
  return new Connection(DEVNET_RPC, "confirmed");
}

export async function treasuryBalance(): Promise<number | null> {
  const addr = treasuryAddress();
  if (!addr) return null;
  try {
    return await connection().getBalance(new PublicKey(addr));
  } catch {
    return null;
  }
}

/** Lamports available to hand out, once the fee floor is set aside. */
export async function spendable(): Promise<number> {
  const bal = await treasuryBalance();
  if (bal === null) return 0;
  return Math.max(0, bal - FEE_FLOOR_LAMPORTS);
}

export async function payout(to: string, lamports: number): Promise<string> {
  const from = treasuryKeypair();
  const recipient = new PublicKey(to);
  const conn = connection();

  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: from.publicKey, toPubkey: recipient, lamports }),
  );

  return sendAndConfirmTransaction(conn, tx, [from], { commitment: "confirmed" });
}