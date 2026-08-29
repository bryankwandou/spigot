import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

/**
 * The dispenser account.
 *
 * A key lives in this deployment, which is a line worth explaining rather than
 * crossing quietly. The rule being followed is not "never hold a key" - it is
 * "never hold a key whose loss costs anything".
 *
 * This keypair was generated for this service alone, starting from an empty
 * balance, and it exists on devnet only. Everything it will ever hold arrives
 * free from a public faucet. If the environment leaks tomorrow, the whole loss
 * is some devnet SOL that anyone can request again, and no account of any real
 * value is reachable from it. That is a risk worth taking to make the thing
 * actually pay out.
 *
 * What must never happen is reusing a wallet that also holds mainnet funds, or
 * one whose seed phrase covers other chains. Those are not a bigger version of
 * this risk, they are a different risk entirely, and no convenience justifies
 * putting one in a serverless environment where it lands in build logs, error
 * reports and every future deploy.
 */
export const TREASURY_ADDRESS =
  process.env.TREASURY_ADDRESS ?? "AsrL4uc9Ct7rhCASJXMhCtAX3k76RgkSsoe3pZFsBdyM";

/** The grants on offer, in SOL. Anything not on this list is refused. */
export const TIERS = [0.1, 0.25, 0.5, 1, 2, 3] as const;
export type Tier = (typeof TIERS)[number];

export function isTier(v: unknown): v is Tier {
  return typeof v === "number" && (TIERS as readonly number[]).includes(v);
}

/**
 * Left untouched no matter what is asked for.
 *
 * Transactions cost lamports, and an account drained to exactly zero cannot pay
 * the fee to send anything ever again - it would need a fresh airdrop just to
 * become usable. Holding a little back keeps the dispenser able to serve the
 * next person the moment a grant lands.
 */
export const RESERVE_LAMPORTS = 0.02 * LAMPORTS_PER_SOL;

export function treasuryKey(): PublicKey {
  return new PublicKey(TREASURY_ADDRESS);
}

/**
 * The signer, or null when no secret is configured.
 *
 * Returning null rather than throwing is deliberate: the board, the probe and
 * the health signal all work without this, and a missing secret should take the
 * dispenser offline with an honest message rather than break the whole site.
 */
export function treasurySigner(): Keypair | null {
  const raw = process.env.TREASURY_SECRET;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as number[];
    const kp = Keypair.fromSecretKey(Uint8Array.from(parsed));
    // A secret that does not match the address we advertise is a
    // misconfiguration that would otherwise pay out of an account nobody is
    // watching. Refuse it.
    if (kp.publicKey.toBase58() !== TREASURY_ADDRESS) return null;
    return kp;
  } catch {
    return null;
  }
}

export type TreasuryState = {
  address: string;
  lamports: number | null;
  sol: number | null;
  explorerUrl: string;
  /** Largest tier the balance can currently cover, or null if none can be. */
  affordableTier: number | null;
  canDispense: boolean;
  error: string | null;
};

/**
 * What is actually in the account right now, read straight from the chain.
 *
 * Reported separately from the probe log on purpose. The log says what the
 * faucet answered; this says what arrived. They can disagree - a confirmed
 * signature with no balance change is exactly the kind of thing worth being
 * able to see rather than infer.
 */
export async function treasuryState(conn: Connection): Promise<TreasuryState> {
  const explorerUrl = `https://explorer.solana.com/address/${TREASURY_ADDRESS}?cluster=devnet`;
  const base = { address: TREASURY_ADDRESS, explorerUrl };
  try {
    const lamports = await conn.getBalance(treasuryKey(), "confirmed");
    const spendable = Math.max(0, lamports - RESERVE_LAMPORTS);
    const affordable = [...TIERS].reverse().find((t) => t * LAMPORTS_PER_SOL <= spendable) ?? null;
    return {
      ...base,
      lamports,
      sol: lamports / LAMPORTS_PER_SOL,
      affordableTier: affordable,
      canDispense: affordable !== null && treasurySigner() !== null,
      error: null,
    };
  } catch (e) {
    return {
      ...base,
      lamports: null,
      sol: null,
      affordableTier: null,
      canDispense: false,
      error: e instanceof Error ? e.message.split("\n")[0].slice(0, 200) : "unreadable",
    };
  }
}

/** Sends one grant. Returns the signature, or throws with the reason. */
export async function dispense(
  conn: Connection,
  to: PublicKey,
  sol: Tier,
): Promise<string> {
  const signer = treasurySigner();
  if (!signer) throw new Error("The dispenser has no key configured.");

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: signer.publicKey,
      toPubkey: to,
      lamports: Math.round(sol * LAMPORTS_PER_SOL),
    }),
  );
  return sendAndConfirmTransaction(conn, tx, [signer], { commitment: "confirmed" });
}
