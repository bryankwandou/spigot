import { neon } from "@neondatabase/serverless";

/**
 * Attempt log, backed by Neon Postgres.
 *
 * Every upstream request is written here whether it succeeded or not. The
 * cooldown clock is measured from the attempt, not from the grant — asking and
 * being refused still counts as having asked, which is the only reading that
 * keeps us on the right side of a rate limit.
 */

export type AttemptOutcome = "granted" | "rate_limited" | "failed" | "human_required";

export type Attempt = {
  faucetId: string;
  at: number;
  outcome: AttemptOutcome;
  lamports: number | null;
  signature: string | null;
  detail: string | null;
};

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  return neon(url);
}

export function isConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function migrate(): Promise<void> {
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS attempts (
      id          BIGSERIAL PRIMARY KEY,
      faucet_id   TEXT        NOT NULL,
      at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      outcome     TEXT        NOT NULL,
      lamports    BIGINT,
      signature   TEXT,
      detail      TEXT
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS attempts_faucet_at ON attempts (faucet_id, at DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS claims (
      id          BIGSERIAL PRIMARY KEY,
      recipient   TEXT        NOT NULL,
      lamports    BIGINT      NOT NULL,
      signature   TEXT        NOT NULL UNIQUE,
      at          TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS claims_recipient_at ON claims (recipient, at DESC)`;
}

/** Timestamp of the most recent attempt against a faucet, successful or not. */
export async function getLastAttempt(faucetId: string): Promise<number | null> {
  const sql = db();
  const rows = (await sql`
    SELECT at FROM attempts WHERE faucet_id = ${faucetId} ORDER BY at DESC LIMIT 1
  `) as Array<{ at: string }>;
  return rows.length ? new Date(rows[0].at).getTime() : null;
}

export async function recordAttempt(
  faucetId: string,
  outcome: AttemptOutcome,
  lamports: number | null = null,
  signature: string | null = null,
  detail: string | null = null,
): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO attempts (faucet_id, outcome, lamports, signature, detail)
    VALUES (${faucetId}, ${outcome}, ${lamports}, ${signature}, ${detail})
  `;
}

export async function recentAttempts(limit = 25): Promise<Attempt[]> {
  const sql = db();
  const rows = (await sql`
    SELECT faucet_id, at, outcome, lamports, signature, detail
    FROM attempts ORDER BY at DESC LIMIT ${limit}
  `) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    faucetId: String(r.faucet_id),
    at: new Date(String(r.at)).getTime(),
    outcome: String(r.outcome) as AttemptOutcome,
    lamports: r.lamports === null ? null : Number(r.lamports),
    signature: r.signature === null ? null : String(r.signature),
    detail: r.detail === null ? null : String(r.detail),
  }));
}

/** Lamports handed out to one recipient since a given moment. */
export async function claimedSince(recipient: string, sinceMs: number): Promise<number> {
  const sql = db();
  const rows = (await sql`
    SELECT COALESCE(SUM(lamports), 0) AS total
    FROM claims
    WHERE recipient = ${recipient} AND at >= ${new Date(sinceMs).toISOString()}
  `) as Array<{ total: string }>;
  return Number(rows[0]?.total ?? 0);
}

export async function recordClaim(
  recipient: string,
  lamports: number,
  signature: string,
): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO claims (recipient, lamports, signature)
    VALUES (${recipient}, ${lamports}, ${signature})
    ON CONFLICT (signature) DO NOTHING
  `;
}
