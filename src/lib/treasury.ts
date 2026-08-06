import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

/**
 * The devnet treasury.
 *
 * The secret key is read from the environment as a JSON array of bytes — the
 * same shape `solana-keygen` writes. It is never read from a file inside the
 * repository and never returned by any route. Only `treasuryAddress()` is safe
 * to expose, and it is a public key by definition.
 */

export const DEVNET_RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

export function connection(): Connection {
  return new Connection(DEVNET_RPC, "confirmed");
}

export function treasuryAddress(): PublicKey | null {
  const addr = process.env.SPIGOT_TREASURY_ADDRESS;
  if (!addr) return null;
  try {
    return new PublicKey(addr);
  } catch {
    return null;
  }
}

/** Only available where a payout is actually signed. Throws if unset. */
export function treasuryKeypair(): Keypair {
  const raw = process.env.SPIGOT_TREASURY_SECRET;
  if (!raw) throw new Error("SPIGOT_TREASURY_SECRET is not set.");

  let bytes: number[];
  try {
    bytes = JSON.parse(raw);
  } catch {
    throw new Error("SPIGOT_TREASURY_SECRET must be a JSON array of bytes.");
  }
  if (!Array.isArray(bytes) || bytes.length !== 64) {
    throw new Error("SPIGOT_TREASURY_SECRET must contain exactly 64 bytes.");
  }

  const kp = Keypair.fromSecretKey(Uint8Array.from(bytes));

  // Guard against a mismatched pair: if the public address is configured
  // separately, the two must describe the same wallet.
  const declared = treasuryAddress();
  if (declared && !declared.equals(kp.publicKey)) {
    throw new Error("Treasury secret does not match SPIGOT_TREASURY_ADDRESS.");
  }
  return kp;
}

export async function treasuryBalance(): Promise<number> {
  const addr = treasuryAddress();
  if (!addr) return 0;
  return connection().getBalance(addr);
}

/** Sends devnet SOL from the treasury to a developer. Returns the signature. */
export async function payout(recipient: PublicKey, lamports: number): Promise<string> {
  const payer = treasuryKeypair();
  const conn = connection();

  const balance = await conn.getBalance(payer.publicKey);
  // Keep a small floor so the treasury can always pay its own fees.
  const floor = 0.01 * LAMPORTS_PER_SOL;
  if (balance - lamports < floor) {
    throw new Error("The treasury is too low to cover this request right now.");
  }

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: recipient,
      lamports,
    }),
  );

  return sendAndConfirmTransaction(conn, tx, [payer], { commitment: "confirmed" });
}
