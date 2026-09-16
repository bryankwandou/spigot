/**
 * Strip anything secret out of an upstream's error text.
 *
 * Faucet errors quote the URL they failed against, and one of those URLs
 * carries our Helius key in a query parameter. Publishing the refusal is the
 * whole point of the board — it is the evidence that the probe ran and what it
 * was told — so the text goes out in public, and it must not take the key with
 * it.
 *
 * This runs on the way in and again on the way out. On the way in so nothing
 * secret is ever written down; on the way out because rows already in the
 * database were written before this existed.
 */
const SECRET_PARAMS = /\b(api[-_]?key|apikey|access[-_]?token|token|key)=([^&\s"']+)/gi;

/** A bare key that appears without a parameter name, as a path segment. */
const UUIDISH = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

export function redact(text: string): string {
  return text.replace(SECRET_PARAMS, (_m, name: string) => `${name}=REDACTED`).replace(
    UUIDISH,
    "REDACTED",
  );
}
