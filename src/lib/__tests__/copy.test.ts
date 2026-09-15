import { test } from "node:test";
import assert from "node:assert/strict";
import { COPY, LANGS, pickLang } from "../copy.ts";

/**
 * A half-translated page is worse than an untranslated one.
 *
 * The failure mode is not a crash. Add a string to `en`, forget it in `id`, and
 * React renders `undefined` into the middle of an Indonesian paragraph — or,
 * worse, the key exists but still holds the English sentence and the reader
 * simply hits a wall of a language they did not choose. Neither shows up in a
 * typecheck if the dictionaries are typed loosely, and neither shows up in a
 * build. So walk both trees and compare them key for key.
 */

type Node = { [k: string]: unknown };

function paths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => paths(v, `${prefix}[${i}]`));
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Node).flatMap(([k, v]) =>
      paths(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [prefix];
}

test("both languages carry exactly the same keys", () => {
  const en = paths(COPY.en).sort();
  const id = paths(COPY.id).sort();

  const missingFromId = en.filter((p) => !id.includes(p));
  const extraInId = id.filter((p) => !en.includes(p));

  assert.deepEqual(missingFromId, [], `written in English but never translated:\n  ${missingFromId.join("\n  ")}`);
  assert.deepEqual(extraInId, [], `present in Indonesian but not in English:\n  ${extraInId.join("\n  ")}`);
});

test("every string is actually filled in", () => {
  for (const lang of LANGS) {
    const walk = (v: unknown, at: string): void => {
      if (typeof v === "string") {
        assert.ok(v.trim().length > 0, `${lang}.${at} is empty`);
        return;
      }
      if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${at}[${i}]`));
      if (v && typeof v === "object") {
        return Object.entries(v as Node).forEach(([k, x]) => walk(x, at ? `${at}.${k}` : k));
      }
    };
    walk(COPY[lang], "");
  }
});

/**
 * The Indonesian must not simply be the English again. A missed translation
 * that copies the source string passes the key check and still leaves the
 * reader on an English sentence, so compare the prose itself.
 *
 * Short shared tokens are exempted rather than fought: "SOL", "Devnet" and
 * "Airdrop" are the same word in both languages and forcing a difference would
 * mean inventing one.
 */
test("the Indonesian is a translation, not a copy", () => {
  const SHARED = new Set(["SOL", "Devnet", "Airdrop", "Faucet", "English", "Bahasa Indonesia"]);
  const en = paths(COPY.en);

  const read = (root: unknown, path: string): unknown =>
    path
      .replace(/\[(\d+)\]/g, ".$1")
      .split(".")
      .filter(Boolean)
      .reduce<unknown>((acc, k) => (acc as Node)?.[k], root);

  const untranslated: string[] = [];
  for (const p of en) {
    const a = read(COPY.en, p);
    const b = read(COPY.id, p);
    if (typeof a !== "string" || typeof b !== "string") continue;
    if (a.length < 12) continue; // labels and single words
    if (SHARED.has(a)) continue;
    if (a === b) untranslated.push(p);
  }

  assert.deepEqual(
    untranslated,
    [],
    `these read identically in both languages, so they were never translated:\n  ${untranslated.join("\n  ")}`,
  );
});

test("a saved choice beats the browser, and Indonesian browsers get Indonesian", () => {
  assert.equal(pickLang("id", ["en-US"]), "id", "a deliberate choice must win");
  assert.equal(pickLang("en", ["id-ID"]), "en");
  assert.equal(pickLang(null, ["id-ID", "en-US"]), "id");
  assert.equal(pickLang(null, ["in-ID"]), "id", "`in` is the legacy tag for Indonesian");
  assert.equal(pickLang(null, ["en-GB"]), "en");
  assert.equal(pickLang(null, []), "en", "no signal at all falls back rather than throwing");
  assert.equal(pickLang("fr", ["id"]), "id", "a saved value we do not support is not trusted");
});
