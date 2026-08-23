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

/**
 * Both shapes a wallet actually hands you.
 *
 * Solflare and Phantom export base58; the CLI writes a JSON array of bytes.
 * Accepting either means nobody has to run a conversion script against their
 * own key to fill in one environment variable — the step where secrets most
 * often end up pasted somewhere they should not be.
 */
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** Base58 decode, written out so the treasury pulls in no extra dependency. */
function base58Decode(input: string): Uint8Array {
  const out: number[] = [];
  for (const ch of input) {
    let carry = B58.indexOf(ch);
    if (carry < 0) throw new Error("not base58");
    for (let i = 0; i < out.length; i++) {
      carry += out[i] * 58;
      out[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      out.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // Every leading '1' in base58 stands for one leading zero byte.
  for (let i = 0; i < input.length && input[i] === "1"; i++) out.push(0);
  return Uint8Array.from(out.reverse());
}

function decodeSecret(raw: string): Uint8Array {
  const trimmed = raw.trim();

  if (trimmed.startsWith("[")) {
    let bytes: unknown;
    try {
      bytes = JSON.parse(trimmed);
    } catch {
      throw new Error("SPIGOT_TREASURY_SECRET looks like JSON but does not parse.");
    }
    if (!Array.isArray(bytes) || bytes.length !== 64) {
      throw new Error("SPIGOT_TREASURY_SECRET must contain exactly 64 bytes.");
    }
    return Uint8Array.from(bytes as number[]);
  }

  let decoded: Uint8Array;
  try {
    decoded = base58Decode(trimmed);
  } catch {
    throw new Error("SPIGOT_TREASURY_SECRET must be base58 or a JSON array of 64 bytes.");
  }
  if (decoded.length !== 64) {
    throw new Error("SPIGOT_TREASURY_SECRET must decode to exactly 64 bytes.");
  }
  return decoded;
}

export function treasuryKeypair(): Keypair {
  const raw = process.env.SPIGOT_TREASURY_SECRET;
  if (!raw) throw new Error("SPIGOT_TREASURY_SECRET is not set.");

  const kp = Keypair.fromSecretKey(decodeSecret(raw));

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
