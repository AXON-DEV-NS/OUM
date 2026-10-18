import { z } from "zod";
import { CheckOutcomeSchema } from "@/src/pipeline/schemas/qa";
import { runChecks } from "@/src/pipeline/checks";
import { checkAgainstArchive, checkDescription, checkHooks, checkScriptText, checkTags, checkTitle, countWords } from "@/src/pipeline/checks/text";
import { defineSkill } from "@/src/skills/_types";

export const Input = z.strictObject({
  title: z.string().max(200).optional(),
  description: z.string().max(6000).optional(),
  tags: z.array(z.string().max(60)).max(40).optional(),
  script: z.string().max(20000).optional(),
  hooks: z.array(z.string().max(140)).max(8).optional(),
  chapters: z.array(z.strictObject({ at: z.string().max(10), label: z.string().max(120) })).max(40).optional(),
  thumbnails: z.array(z.strictObject({ overlayText: z.string().max(60) })).max(4).optional(),
  expectedDurationSec: z.number().min(5).max(3600).optional(),
  plannedDurationSec: z.number().min(5).max(3600).optional(),
  targetMinutes: z.number().min(0.5).max(60).optional(),
  archive: z.array(z.string().max(300)).max(200).default([]),
});

export const Output = z.strictObject({
  outcomes: z.array(CheckOutcomeSchema).max(200),
  score: z.number().int().min(0).max(100),
  pass: z.boolean(),
});

export const deterministicChecklist = defineSkill({
  key: "deterministic-checklist",
  version: "1.0.0",
  goal: "The master deterministic gate of stage S8: run every code check that applies to the artifact bundle in one pass.",
  kind: "code",
  path: "any",
  stages: ["S8"],
  input: Input,
  output: Output,
  checklist: [
    "title/description/tags/script/hooks limits enforced",
    "chapters ordered, first at 0:00, >= 10s apart when present",
    "thumbnail overlays at most 4 words (configured limit)",
    "archive similarity below the duplicate threshold",
    "score is the weighted percent of passed checks",
  ],
  examples: [
    {
      name: "clean-bundle",
      input: {
        title: "لماذا تسخن بطارية هاتفك؟ الأسباب الحقيقية",
        description: "شرح بسيط وعملي لسبب سخونة البطارية وكيف تحمي هاتفك من التلف عبر خطوات واضحة تستطيع تطبيقها اليوم.".padEnd(90, " "),
        tags: ["بطارية", "هاتف"],
        hooks: ["هاتفك بيسخن؟ السبب مش اللي بتظنّه.", "٩٠٪ من الناس يخطئون في هذا الأمر.", "قبل أن يتلف هاتفك.. افعل هذا فوراً."],
        thumbnails: [{ overlayText: "سبب مفاجئ" }],
        archive: [],
      },
      expectOutput: { pass: true },
    },
  ],
  implemented: true,
  async run(_rt, input) {
    const checks = [];
    if (input.title !== undefined) checks.push(checkTitle);
    if (input.description !== undefined) checks.push(checkDescription);
    if (input.tags !== undefined) checks.push(checkTags);
    if (input.hooks !== undefined) checks.push(checkHooks);
    if (input.script !== undefined) checks.push(checkScriptText);
    if (input.chapters !== undefined) {
      checks.push({
        key: "text.chapters",
        run: ({ chapters }: { chapters: Array<{ at: string; label: string }> }) => {
          if (chapters.length === 0) return { key: "text.chapters", pass: true, severity: "info" as const, message: "no chapters (allowed)" };
          const first = chapters[0].at;
          if (first !== "0:00") return { key: "text.chapters", pass: false, severity: "fail" as const, message: `first chapter must start at 0:00 (got ${first})` };
          const toSec = (t: string) => {
            const parts = t.split(":").map(Number);
            return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
          };
          let prev: number | null = null;
          for (const c of chapters) {
            const s = toSec(c.at);
            if (prev !== null && s - prev < 10) return { key: "text.chapters", pass: false, severity: "fail" as const, message: `chapters must be >= 10s apart (${c.at})` };
            prev = s;
          }
          return { key: "text.chapters", pass: true, severity: "info" as const };
        },
      });
    }
    if (input.thumbnails !== undefined) {
      checks.push({
        key: "seo.thumbnail-words",
        run: ({ thumbnails }: { thumbnails: Array<{ overlayText: string }> }) => {
          for (const t of thumbnails) {
            const words = t.overlayText.trim().split(/\s+/).filter(Boolean).length;
            if (words > 4) return { key: "seo.thumbnail-words", pass: false, severity: "fail" as const, message: `overlay "${t.overlayText}" has ${words} words (max 4)`, fix: "shorten the thumbnail text to 4 words or fewer", fixStage: "S7" };
          }
          return { key: "seo.thumbnail-words", pass: true, severity: "info" as const };
        },
      });
    }
    if (input.expectedDurationSec !== undefined && input.plannedDurationSec !== undefined) {
      checks.push({
        key: "media.duration-plan",
        run: (x: { expectedDurationSec?: number; plannedDurationSec?: number }) => {
          const e = x.expectedDurationSec!;
          const p = x.plannedDurationSec!;
          const diff = Math.abs(e - p) / p;
          return diff > 0.2
            ? { key: "media.duration-plan", pass: false, severity: "warn" as const, message: `render ${e}s vs planned ${p}s (±${Math.round(diff * 100)}%)` }
            : { key: "media.duration-plan", pass: true, severity: "info" as const };
        },
      });
    }
    if (input.script !== undefined && input.archive.length) {
      checks.push(checkAgainstArchive(() => input.archive));
    }

    const summary = await runChecks(
      checks as Parameters<typeof runChecks>[0],
      {
        title: input.title ?? "",
        description: input.description ?? "",
        tags: input.tags ?? [],
        script: input.script ?? "",
        hooks: input.hooks ?? [],
        chapters: input.chapters ?? [],
        thumbnails: input.thumbnails ?? [],
        expectedDurationSec: input.expectedDurationSec,
        plannedDurationSec: input.plannedDurationSec,
        targetMinutes: input.targetMinutes,
        text: input.script ?? input.title ?? "",
      } as never,
    );
    if (input.targetMinutes && input.script) {
      const words = countWords(input.script);
      const wpm = words / input.targetMinutes;
      if (wpm < 80 || wpm > 230) {
        summary.outcomes.push({ key: "text.pace-audit", pass: false, severity: "warn", message: `${Math.round(wpm)} words/min vs ${input.targetMinutes} min target` });
      }
    }
    return { outcomes: summary.outcomes, score: summary.score, pass: summary.pass };
  },
});
