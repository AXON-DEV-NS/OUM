import { z } from "zod";
import { defineSkill } from "@/src/skills/_types";

export const Input = z.strictObject({
  title: z.string().min(8).max(140),
  thumbnailOverlay: z.string().max(60),
  hook: z.string().max(140),
  score: z.number().int().min(0).max(100),
  costSpentCents: z.number().int().min(0),
  costCapCents: z.number().int().min(0),
  durationSec: z.number().min(1).max(3600),
  fixesApplied: z.array(z.string().max(300)).max(20),
  chaptersCount: z.number().int().min(0).max(40),
  disclosureText: z.string().max(400),
});

export const Output = z.strictObject({
  summary: z.strictObject({
    title: z.string().max(140),
    headline: z.string().max(300),
    points: z.array(z.string().max(300)).max(8),
    costLine: z.string().max(200),
    fixesLine: z.string().max(400),
  }),
});

export const approvalSummarizer = defineSkill({
  key: "approval-summarizer",
  version: "1.0.0",
  goal: "Assemble the one-screen approval brief the human sees at stage S9: title, hook, QA score, cost and fixes already applied.",
  kind: "code",
  path: "any",
  stages: ["S9"],
  input: Input,
  output: Output,
  checklist: [
    "cost line always shows spent vs cap in cents",
    "fixes line says 'none' when no fixes were applied",
    "points list stays <= 8 items",
  ],
  examples: [
    {
      name: "typical",
      input: {
        title: "لماذا تسخن بطارية هاتفك؟",
        thumbnailOverlay: "سبب مفاجئ",
        hook: "هاتفك بيسخن؟ السبب مش اللي بتظنّه.",
        score: 91,
        costSpentCents: 240,
        costCapCents: 1500,
        durationSec: 185,
        fixesApplied: ["تم تقصير العنوان إلى 58 حرفاً"],
        chaptersCount: 4,
        disclosureText: "يحتوي هذا الفيديو على مشاهد وصوت مولّدين بالذكاء الاصطناعي.",
      },
      expectOutput: {},
    },
  ],
  implemented: true,
  async run(_rt, input) {
    const minutes = Math.floor(input.durationSec / 60);
    const seconds = Math.round(input.durationSec % 60);
    return {
      summary: {
        title: input.title,
        headline: `النتيجة النهائية ${input.score}/100 — جاهز للاعتماد`,
        points: [
          `الخطاف: ${input.hook}`,
          `نص الصورة المصغرة: ${input.thumbnailOverlay}`,
          `المدة: ${minutes}:${String(seconds).padStart(2, "0")}`,
          `الفصول: ${input.chaptersCount}`,
          `الإفصاح: ${input.disclosureText || "غير مطلوب"}`,
        ],
        costLine: `التكلفة: ${input.costSpentCents}c من أصل ${input.costCapCents}c`,
        fixesLine: input.fixesApplied.length ? `إصلاحات تمت: ${input.fixesApplied.join("؛ ")}` : "لا إصلاحات — اجتاز كل الفحوص من أول مرة",
      },
    };
  },
});
