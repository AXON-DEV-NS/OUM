/**
 * Text-level deterministic checks: length limits, placeholder markers,
 * duplicate paragraphs, hook uniqueness, archive similarity.
 *
 * Similarity uses word trigrams + Jaccard — cheap, language-agnostic enough
 * for Arabic and English, and fully deterministic (same input -> same score).
 */
import { CONFIG } from "@/src/pipeline/config";
import { fail, ok, warn, type CheckOutcome, type DeterministicCheck } from "./index";

const MARKERS = ["todo", "tbd", "lorem ipsum", "placeholder", "xxx", "{{", "}}", "[insert", "fixme"];

export function countWords(text: string): number {
  return text
    .replace(/[\u064B-\u0652]/g, "") // strip Arabic diacritics
    .split(/\s+/)
    .filter(Boolean).length;
}

export function findMarkers(text: string): string[] {
  const lower = text.toLowerCase();
  return MARKERS.filter((m) => lower.includes(m));
}

export function trigrams(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const set = new Set<string>();
  if (words.length < 3) {
    if (words.length) set.add(words.join(" "));
    return set;
  }
  for (let i = 0; i <= words.length - 3; i++) set.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  return set;
}

/** Jaccard similarity of word trigrams, 0..1 */
export function similarity(a: string, b: string): number {
  const A = trigrams(a);
  const B = trigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

export function maxSimilarity(text: string, corpus: string[]): { score: number; against: string | null } {
  let best = 0;
  let against: string | null = null;
  for (const c of corpus) {
    const s = similarity(text, c);
    if (s > best) {
      best = s;
      against = c;
    }
  }
  return { score: best, against };
}

export function duplicateParagraphs(text: string): number {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => countWords(p) > 12);
  let dups = 0;
  for (let i = 1; i < paragraphs.length; i++) {
    if (similarity(paragraphs[i], paragraphs[i - 1]) > 0.9) dups++;
  }
  return dups;
}

// ── Check objects ────────────────────────────────────────────────

export interface TitleInput {
  title: string;
}
export const checkTitle: DeterministicCheck<TitleInput> = {
  key: "text.title",
  run({ title }): CheckOutcome {
    const n = title.trim().length;
    if (n < CONFIG.lengths.titleMinChars) return fail("text.title", `title too short (${n} chars, min ${CONFIG.lengths.titleMinChars})`, { fix: "make the title descriptive" });
    if (n > CONFIG.lengths.titleMaxChars) return fail("text.title", `title too long (${n} chars, max ${CONFIG.lengths.titleMaxChars})`, { fix: "shorten the title to at most 100 characters" });
    const markers = findMarkers(title);
    if (markers.length) return fail("text.title", `placeholders in title: ${markers.join(", ")}`);
    if (title === title.toUpperCase() && /[A-Z]/.test(title)) return warn("text.title", "title is ALL CAPS");
    return ok("text.title");
  },
};

export interface DescriptionInput {
  description: string;
}
export const checkDescription: DeterministicCheck<DescriptionInput> = {
  key: "text.description",
  run({ description }): CheckOutcome {
    const n = description.trim().length;
    if (n < CONFIG.lengths.descriptionMinChars) return fail("text.description", `description too short (${n} chars, min ${CONFIG.lengths.descriptionMinChars})`);
    if (n > CONFIG.lengths.descriptionMaxChars) return fail("text.description", `description too long (${n} chars, max ${CONFIG.lengths.descriptionMaxChars})`);
    const markers = findMarkers(description);
    if (markers.length) return fail("text.description", `placeholders in description: ${markers.join(", ")}`);
    return ok("text.description");
  },
};

export interface TagsInput {
  tags: string[];
}
export const checkTags: DeterministicCheck<TagsInput> = {
  key: "text.tags",
  run({ tags }): CheckOutcome {
    const total = tags.reduce((s, t) => s + t.length + 1, 0);
    if (total > CONFIG.lengths.tagsMaxTotalChars) {
      return fail("text.tags", `tags exceed ${CONFIG.lengths.tagsMaxTotalChars} chars total (${total})`, { fix: "drop the least relevant tags" });
    }
    return ok("text.tags");
  },
};

export interface HooksInput {
  hooks: string[];
}
export const checkHooks: DeterministicCheck<HooksInput> = {
  key: "text.hooks",
  run({ hooks }): CheckOutcome {
    if (hooks.length < 3) return fail("text.hooks", `need at least 3 hooks (got ${hooks.length})`);
    for (const h of hooks) {
      if (h.trim().length < CONFIG.lengths.hookMinChars) return fail("text.hooks", `hook too short: "${h.slice(0, 30)}"`);
      if (h.length > CONFIG.lengths.hookMaxChars) return fail("text.hooks", `hook too long (${h.length} chars)`);
    }
    const seen: string[] = [];
    for (const h of hooks) {
      if (seen.some((s) => similarity(s, h) > 0.65)) return fail("text.hooks", `hooks too similar: two hooks share >65% of their phrasing`, { fix: "rewrite the hooks with distinct angles" });
      seen.push(h);
    }
    return ok("text.hooks");
  },
};

export interface ScriptTextInput {
  script: string;
  targetMinutes?: number;
}
export const checkScriptText: DeterministicCheck<ScriptTextInput> = {
  key: "text.script",
  run({ script, targetMinutes }): CheckOutcome {
    const words = countWords(script);
    if (words < CONFIG.lengths.scriptMinWords) return fail("text.script", `script too short (${words} words, min ${CONFIG.lengths.scriptMinWords})`);
    if (words > CONFIG.lengths.scriptMaxWords) return fail("text.script", `script too long (${words} words, max ${CONFIG.lengths.scriptMaxWords})`);
    const markers = findMarkers(script);
    if (markers.length) return fail("text.script", `placeholders left in script: ${markers.join(", ")}`, { fix: "rewrite the placeholder passages" });
    const dups = duplicateParagraphs(script);
    if (dups > 0) return fail("text.script", `${dups} duplicated paragraph(s) in the script`);
    if (targetMinutes) {
      const wpm = words / targetMinutes;
      if (wpm < CONFIG.lengths.scriptWpmLow || wpm > CONFIG.lengths.scriptWpmHigh) {
        return warn("text.script", `speaking pace ${Math.round(wpm)} words/min is outside ${CONFIG.lengths.scriptWpmLow}-${CONFIG.lengths.scriptWpmHigh} for a ${targetMinutes}-minute video`);
      }
    }
    return ok("text.script", `${words} words`);
  },
};

/** build a check that scans a text against recent archive titles */
export function checkAgainstArchive(getCorpus: (input: unknown) => string[]): DeterministicCheck<{ text: string }> {
  return {
    key: "text.archive-similarity",
    async run(input): Promise<CheckOutcome> {
      const corpus = getCorpus(input);
      if (!corpus.length) return ok("text.archive-similarity", "empty archive");
      const { score, against } = maxSimilarity(input.text, corpus);
      if (score >= CONFIG.similarity.duplicateThreshold) {
        return fail("text.archive-similarity", `too similar to a previous video (${Math.round(score * 100)}% vs "${against?.slice(0, 60)}")`, {
          fix: "pick a different angle — viewers already saw this",
        });
      }
      return ok("text.archive-similarity", `max similarity ${Math.round(score * 100)}%`);
    },
  };
}
