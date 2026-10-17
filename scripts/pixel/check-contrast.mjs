#!/usr/bin/env node
/**
 * Pixel edge system — contrast verifier (WCAG 2.x relative luminance).
 *
 * Proves the smart-colour rule: every frame token holds >= 3:1 against the
 * surfaces it is allowed to touch (the surface OUTSIDE the element and the
 * fill INSIDE it). Tokens are read from the generated CSS — the single
 * source of truth — so this check can never drift from what ships.
 *
 * Usage: node scripts/pixel/check-contrast.mjs
 * Exit code 1 if any REQUIRED pair fails.
 */
import fs from "node:fs";
import path from "node:path";

const css = fs.readFileSync(path.resolve("app/px-frames.generated.css"), "utf8");
/* static patterns only — token names are fixed, no dynamic RegExp construction */
const TOKEN_RE = /--px-(ink|light|red|green|gold):\s*(#[0-9A-Fa-f]{6})/g;
const FOUND = {};
for (const m of css.matchAll(TOKEN_RE)) FOUND[m[1]] = m[2];
const token = (name) => {
  const v = FOUND[name];
  if (!v) throw new Error(`token --px-${name} not found in generated CSS`);
  return v;
};

const C = {
  ink: token("ink"),
  light: token("light"),
  red: token("red"),
  green: token("green"),
  gold: token("gold"),
};

/* palette surfaces (tailwind.config.ts + Tailwind defaults used by the site) */
const S = {
  paper: "#F5EFE1",
  "paper-high": "#FBF7ED",
  "paper-low": "#EDE4D0",
  "ink-soft": "#3B372F",
  "green-50": "#EAF0E9",
  "green-100": "#D5E0D3",
  "green-600": "#335433",
  "red-50": "#FEF2F2",
  "red-100": "#FEE2E2",
  "red-600": "#DC2626",
  "amber-50": "#FFFBEB",
  "emerald-50": "#ECFDF5",
  "emerald-600": "#059669",
  "gold-50": "#FBF3E2",
  "gold-100": "#F6E6C4",
  "blue-50": "#EFF6FF",
};

const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const chan = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * chan[0] + 0.7152 * chan[1] + 0.0722 * chan[2];
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/* [frame token, surface token] — every pair the app actually renders.
   required=false pairs are documented-but-unused safety notes. */
const PAIRS = [
  // ink frames on light surfaces (default edge) + light fills they border
  ["ink", "paper", true],
  ["ink", "paper-high", true],
  ["ink", "paper-low", true],
  ["ink", "green-50", true],
  ["ink", "green-100", true],
  ["ink", "red-50", true],
  ["ink", "red-100", true],
  ["ink", "amber-50", true],
  ["ink", "emerald-50", true],
  ["ink", "gold-50", true],
  ["ink", "gold-100", true],
  ["ink", "blue-50", true],
  // light frames on dark surfaces + dark fills they border
  ["light", "ink-soft", true],
  ["light", "green-600", true],
  ["light", "red-600", true],
  ["light", "emerald-600", true],
  // semantic frames on their surfaces
  ["red", "paper", true],
  ["red", "paper-high", true],
  ["red", "red-50", true],
  ["green", "paper", true],
  ["green", "paper-high", true],
  ["green", "green-50", true],
  ["green", "green-100", true],
  ["green", "emerald-50", true],
  ["gold", "paper", true],
  ["gold", "paper-high", true],
  ["gold", "gold-50", true],
  // focus ring (gold) against both page surfaces
  ["gold", "paper", true],
  ["gold", "paper-high", true],
  // documented-but-unused: light frame must NOT be used on bright fills
  ["light", "#C0851F", false],
];

let failures = 0;
console.log("Pixel edge contrast audit (WCAG ratio, threshold 3.0 for non-text edges)\n");
console.log("frame   → surface        ratio   verdict");
console.log("──────────────────────────────────────────────");
for (const [f, s, required] of PAIRS) {
  const fg = C[f];
  const bg = s.startsWith("#") ? s : S[s];
  const r = ratio(fg, bg);
  const ok = r >= 3;
  if (!ok && required) failures++;
  const verdict = ok ? "PASS" : required ? "FAIL (required)" : "note (avoid this pair)";
  console.log(`${f.padEnd(7)} → ${s.padEnd(14)} ${r.toFixed(2).padStart(5)}   ${verdict}`);
}

/* two-tone frames: the outer band must win on light surroundings, the inner
   band on dark/coloured fills — verify both halves of both frames. */
console.log("\nTwo-tone frames (both bands must pass on their side):");
const duoChecks = [
  ["duo outer", C.ink, S.paper],
  ["duo outer", C.ink, S["paper-high"]],
  ["duo inner", C.light, "#1B1915"],
  ["duo inner", C.light, S["green-600"]],
  ["duo inner", C.light, S["red-600"]],
  ["duo inner", C.light, S["emerald-600"]],
];
for (const [band, fg, bg] of duoChecks) {
  const r = ratio(fg, bg);
  const ok = r >= 3;
  if (!ok) failures++;
  console.log(`${band.padEnd(9)} ${fg} vs ${bg.padEnd(9)} ${r.toFixed(2).padStart(5)}   ${ok ? "PASS" : "FAIL"}`);
}

console.log(`\n${failures === 0 ? "ALL REQUIRED PAIRS PASS ✓" : `${failures} REQUIRED PAIR(S) FAILED ✗`}`);
process.exitCode = failures > 0 ? 1 : 0;
