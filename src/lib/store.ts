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
    CREATE TABLE IF NOT EXISTS dispenses (
      id        BIGSERIAL PRIMARY KEY,
      address   TEXT        NOT NULL,
      at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      sol       DOUBLE PRECISION NOT NULL,
      signature TEXT        NOT NULL
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS dispenses_address_at ON dispenses (address, at DESC)`;
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

/**
 * Whether this address already reported this faucet very recently.
 *
 * The board's whole value is that its numbers mean something, and the report
 * log is the one surface anyone can write to. Without a floor between writes a
 * single caller can decide what every reader sees, which costs one loop and
 * ruins the only thing being sold. This is a speed bump, not an identity
 * check: an address is free to generate, so the point is to make poisoning
 * tedious rather than impossible, without asking an honest developer to prove
 * anything.
 */
export async function reportedRecently(
  faucetId: string,
  address: string,
  withinMs: number,
): Promise<number | null> {
  const sql = db();
  const since = new Date(Date.now() - withinMs).toISOString();
  const rows = (await sql`
    SELECT at FROM reports
    WHERE faucet_id = ${faucetId} AND address = ${address} AND at >= ${since}
    ORDER BY at DESC LIMIT 1
  `) as Array<{ at: string }>;
  return rows.length ? new Date(rows[0].at).getTime() : null;
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

/**
 * When this address was last paid, which is the whole rate limit.
 *
 * Written before the transfer is attempted would be safer against a double
 * spend but would charge people for failures; written after means a crash
 * between send and insert gives someone a free second turn. The second failure
 * costs devnet SOL that arrived free, the first costs someone their turn for
 * eight hours, so this errs toward the cheaper mistake.
 */
export async function lastDispenseAt(address: string): Promise<number | null> {
  const sql = db();
  const rows = (await sql`
    SELECT at FROM dispenses WHERE address = ${address} ORDER BY at DESC LIMIT 1
  `) as Array<{ at: string }>;
  return rows.length ? new Date(rows[0].at).getTime() : null;
}

export async function recordDispense(
  address: string,
  sol: number,
  signature: string,
): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO dispenses (address, sol, signature) VALUES (${address}, ${sol}, ${signature})
  `;
}

/** Running totals, for the board. Nothing here identifies anyone. */
export async function dispenseTotals(): Promise<{ count: number; sol: number }> {
  const sql = db();
  const rows = (await sql`
    SELECT COUNT(*)::int AS count, COALESCE(SUM(sol), 0)::float8 AS sol FROM dispenses
  `) as Array<{ count: number; sol: number }>;
  return rows.length ? { count: rows[0].count, sol: rows[0].sol } : { count: 0, sol: 0 };
}
