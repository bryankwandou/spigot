import { neon } from "@neondatabase/serverless";

/**
 * Two logs, backed by Neon Postgres.
 *
 * `probes` is what Spigot itself observed: one request per faucet per cooldown
 * window, from one host. It is small on purpose.
 *
 * `reports` is what developers tell us happened when they clicked through. This
 * is the honest source of a live health signal — thousands of people already
 * discover a dry faucet every day, and today that knowledge dies in each of
 * their terminals separately. Pooling it costs the upstreams nothing.
 *
 * Both logs measure from the moment of asking, not of receiving. Being refused
 * still counts as having asked, which is the only reading that keeps a cooldown
 * honest.
 */

export type Outcome = "granted" | "rate_limited" | "dry" | "failed";

export type Event = {
  faucetId: string;
  at: number;
  outcome: Outcome;
  source: "probe" | "report";
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
    CREATE TABLE IF NOT EXISTS probes (
      id        BIGSERIAL PRIMARY KEY,
      faucet_id TEXT        NOT NULL,
      at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      outcome   TEXT        NOT NULL,
      detail    TEXT
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS probes_faucet_at ON probes (faucet_id, at DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS reports (
      id        BIGSERIAL PRIMARY KEY,
      faucet_id TEXT        NOT NULL,
      address   TEXT        NOT NULL,
      at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      outcome   TEXT        NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS reports_faucet_at ON reports (faucet_id, at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS reports_address_at ON reports (address, at DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS claims (
      id        BIGSERIAL PRIMARY KEY,
      recipient TEXT        NOT NULL,
      lamports  BIGINT      NOT NULL,
      signature TEXT        NOT NULL UNIQUE,
      at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS claims_recipient_at ON claims (recipient, at DESC)`;
}

/** Lamports handed to one recipient since a moment. Enforces the daily cap. */
export async function claimedSince(recipient: string, sinceMs: number): Promise<number> {
  const sql = db();
  const rows = (await sql`
    SELECT COALESCE(SUM(lamports), 0) AS total FROM claims
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

export type Claim = { recipient: string; lamports: number; signature: string; at: number };

export async function recentClaims(limit = 8): Promise<Claim[]> {
  const sql = db();
  const rows = (await sql`
    SELECT recipient, lamports, signature, at FROM claims ORDER BY at DESC LIMIT ${limit}
  `) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    recipient: String(r.recipient),
    lamports: Number(r.lamports),
    signature: String(r.signature),
    at: new Date(String(r.at)).getTime(),
  }));
}

/** When Spigot last probed a faucet, granted or not. Drives our own cooldown. */
export async function lastProbeAt(faucetId: string): Promise<number | null> {
  const sql = db();
  const rows = (await sql`
    SELECT at FROM probes WHERE faucet_id = ${faucetId} ORDER BY at DESC LIMIT 1
  `) as Array<{ at: string }>;
  return rows.length ? new Date(rows[0].at).getTime() : null;
}

export async function recordProbe(
  faucetId: string,
  outcome: Outcome,
  detail: string | null = null,
): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO probes (faucet_id, outcome, detail) VALUES (${faucetId}, ${outcome}, ${detail})
  `;
}

/** When a given address last claimed from a faucet. Drives the personal clock. */
export async function lastReportFor(address: string): Promise<Record<string, number>> {
  const sql = db();
  const rows = (await sql`
    SELECT faucet_id, MAX(at) AS at FROM reports
    WHERE address = ${address} GROUP BY faucet_id
  `) as Array<{ faucet_id: string; at: string }>;

  const out: Record<string, number> = {};
  for (const r of rows) out[String(r.faucet_id)] = new Date(String(r.at)).getTime();
  return out;
}

export async function recordReport(
  faucetId: string,
  address: string,
  outcome: Outcome,
): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO reports (faucet_id, address, outcome) VALUES (${faucetId}, ${address}, ${outcome})
  `;
}

/** Everything observed about a faucet since a moment, from both logs. */
export async function eventsSince(sinceMs: number): Promise<Event[]> {
  const sql = db();
  const since = new Date(sinceMs).toISOString();
  const rows = (await sql`
    SELECT faucet_id, at, outcome, 'probe' AS source, detail FROM probes WHERE at >= ${since}
    UNION ALL
    SELECT faucet_id, at, outcome, 'report' AS source, NULL AS detail FROM reports WHERE at >= ${since}
    ORDER BY at DESC
  `) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    faucetId: String(r.faucet_id),
    at: new Date(String(r.at)).getTime(),
    outcome: String(r.outcome) as Outcome,
    source: String(r.source) as "probe" | "report",
    detail: r.detail === null ? null : String(r.detail),
  }));
}
