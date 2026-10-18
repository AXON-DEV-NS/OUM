/**
 * Shared helpers for stage implementations.
 */
import { ChannelDnaSchema, type ChannelDnaJson } from "../schemas/dna";
import { validationFailed } from "../errors";
import type { StageContext, StageKey } from "../stage";

export function dnaJson(ctx: StageContext): ChannelDnaJson {
  if (!ctx.dna) throw validationFailed("channel DNA is missing — stage S0 must run first");
  const parsed = ChannelDnaSchema.safeParse({
    rules: ctx.dna.rules,
    conflicts: ctx.dna.conflicts ?? [],
    competitors: ctx.dna.competitors ?? [],
    audience: ctx.dna.audience,
    avatar: ctx.dna.avatar ?? undefined,
    mode: ctx.dna.mode,
  });
  if (!parsed.success) throw validationFailed("channel DNA failed schema validation", parsed.error.issues.slice(0, 5));
  return parsed.data;
}

export function ruleLines(dna: ChannelDnaJson): string[] {
  return dna.rules.map((r) => `${r.kind}: ${r.text}`);
}

const ARABIC_MARKETS = new Set(["eg", "sa", "ae", "ma", "dz", "tn", "jo", "lb", "iq", "sy", "kw", "qa", "bh", "om", "ye", "sd", "ly", "ps"]);

export function isArabic(locale: string, markets: string[]): boolean {
  return locale.toLowerCase().startsWith("ar") || markets.some((m) => ARABIC_MARKETS.has(m.toLowerCase()));
}

/** typed access to a previous stage's output */
export function outputOf<T = unknown>(ctx: StageContext, key: StageKey): T {
  const o = ctx.inputs.of(key);
  if (o === null || o === undefined) throw validationFailed(`output of stage ${key} is missing`);
  return o as T;
}

export function findInOutput<T>(obj: unknown, path: string[]): T | null {
  let cur: unknown = obj;
  for (const p of path) {
    if (cur === null || typeof cur !== "object") return null;
    // own enumerable keys only; dangerous names are never traversed
    if (p === "__proto__" || p === "prototype" || p === "constructor") return null;
    const hit = Object.entries(cur as Record<string, unknown>).find(([k]) => k === p);
    if (!hit) return null;
    cur = hit[1];
  }
  return (cur ?? null) as T | null;
}
