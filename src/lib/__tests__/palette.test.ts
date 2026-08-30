import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Colours that are not in the theme.
 *
 * Tailwind only emits a utility for a colour the theme actually declares. Write
 * `text-mute` when the token is called `mist` and nothing fails: tsc is happy,
 * the build is happy, the class lands in the markup, and no rule ever matches
 * it. The element silently inherits its parent's colour.
 *
 * That is not hypothetical. The treasury card was written with `text-mute` and
 * `text-fg` against a theme holding `mist` and `paper`, and shipped: twenty-three
 * classes, none of them real, so every quiet label in the most important block on
 * the page — the balance, the capacity line, the fee reserve footnote — rendered
 * at full white with no hierarchy at all. The deployed stylesheet was the only
 * place it showed, as an absence.
 *
 * So read the tokens out of the theme and hold the components to them.
 */

const ROOT = join(import.meta.dirname, "../../..");
const CSS = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");

function themeTokens(): Set<string> {
  const block = CSS.match(/@theme\s*\{([\s\S]*?)\n\}/);
  assert.ok(block, "globals.css must declare an @theme block");
  const names = new Set<string>();
  for (const m of block[1].matchAll(/--color-([a-z0-9-]+)\s*:/g)) names.add(m[1]);
  return names;
}

function componentSources(): Array<{ file: string; text: string }> {
  const out: Array<{ file: string; text: string }> = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".tsx")) out.push({ file: p, text: readFileSync(p, "utf8") });
    }
  };
  walk(join(ROOT, "src"));
  return out;
}

// Utilities that take a colour and would fall back to inheritance in silence.
const COLOUR_UTILITY = /\b(?:hover:|focus:|enabled:|disabled:|group-hover:|placeholder:)*(text|bg|border|decoration|fill|stroke|ring|from|via|to)-([a-z][a-z0-9]*)\b/g;

// Tailwind ships these itself; they are not ours to declare.
const BUILT_IN = new Set([
  "white", "black", "transparent", "current", "inherit", "none", "auto",
  "slate", "gray", "zinc", "neutral", "stone", "red", "orange", "amber",
  "yellow", "lime", "green", "emerald", "teal", "cyan", "blue", "violet",
  "purple", "fuchsia", "pink", "rose", "sky", "indigo",
  // non-colour words that share the utility prefix
  "sm", "md", "lg", "xl", "xs", "base", "left", "right", "center", "top",
  "bottom", "solid", "dashed", "dotted", "b", "t", "l", "r", "x", "y",
  "balance", "pretty", "nowrap", "wrap", "clip", "ellipsis", "start", "end",
  "panel", "edge",
]);

test("every colour utility names a token the theme declares", () => {
  const tokens = themeTokens();
  const unknown: string[] = [];

  for (const { file, text } of componentSources()) {
    for (const [cls, , name] of text.matchAll(COLOUR_UTILITY)) {
      if (tokens.has(name) || BUILT_IN.has(name)) continue;
      unknown.push(`${file.slice(ROOT.length + 1)}: ${cls}`);
    }
  }

  assert.deepEqual(
    unknown,
    [],
    `these classes name no theme colour, so Tailwind emits no rule and the element inherits instead:\n  ${unknown.join("\n  ")}`,
  );
});

test("the tokens the components lean on are the ones that exist", () => {
  const tokens = themeTokens();
  // Named rather than counted: renaming one of these breaks pages quietly, so
  // the rename should break this first.
  for (const t of ["ink", "panel", "edge", "mist", "paper", "aqua", "sky", "indigo"]) {
    assert.ok(tokens.has(t), `theme lost the ${t} colour`);
  }
});

test("a quiet label and a loud value are not the same colour", () => {
  const tokens = themeTokens();
  const read = (n: string) => CSS.match(new RegExp(`--color-${n}:\s*([^;]+);`))?.[1].trim();
  assert.notEqual(read("mist"), read("paper"), "secondary text must not equal primary text");
  assert.ok(tokens.has("mist") && tokens.has("paper"));
});
