import { redact } from "./redact.ts";

/**
 * Turn an upstream's raw error text into the sentence it actually said.
 *
 * What the RPC client hands us is a transport error that has the provider's
 * whole JSON-RPC envelope stuffed into its message:
 *
 *   429 Too Many Requests:  {"jsonrpc":"2.0","error":{"code": 429, "message":
 *   "You've either reached your airdrop limit today or ..."}, "id": "..." }
 *
 * Published as-is that is unreadable, and worse, the envelope carries a request
 * id in UUID form that the redactor cannot tell apart from a key — so the
 * public log showed `"id": "REDACTED"` sitting in the middle of the quote,
 * which makes an honest record look edited. Pulling the message out solves both
 * at once: the id is dropped because it was never part of what was said, and
 * what is left is the refusal in the provider's own words.
 *
 * The status line is kept. "429 Too Many Requests" and "403 Forbidden" are
 * different claims about why, and the difference is the entire point of keeping
 * the log — one is a pool that ran out, the other is an allowance that is ours
 * and was spent.
 *
 * Anything that does not parse is passed through unchanged rather than
 * discarded. A message we did not anticipate is exactly the one worth seeing.
 */
export function said(detail: string): string {
  const text = redact(detail).replace(/\s+/g, " ").trim();

  const status = text.match(/^(\d{3}\s+[A-Za-z][A-Za-z ]*?)\s*:/);
  const message = text.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!message) return text;

  // JSON string escapes, undone in the one order that does not corrupt them:
  // a doubled backslash goes last, or a literal `\n` two characters long would
  // first be turned into a space and then be unrecoverable.
  const sentence = message[1]
    .replace(/\\n/g, " ")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .trim();
  if (!sentence) return text;

  return status ? `${status[1].trim()}: ${sentence}` : sentence;
}
