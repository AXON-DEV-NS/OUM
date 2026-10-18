import { z } from "zod";
import { defineSkill } from "@/src/skills/_types";

export const Input = z.strictObject({ reason: z.string().min(2).max(2000) });

export const Output = z.strictObject({
  tags: z.array(z.string().max(40)).max(8),
  note: z.string().max(300),
});

const MAP: Array<{ tag: string; terms: string[] }> = [
  { tag: "hook", terms: ["هوك", "مقدمة", "بداية", "افتتاحية", "hook", "intro"] },
  { tag: "tone", terms: ["أسلوب", "نبرة", "لهجة", "طابع", "tone", "style"] },
  { tag: "title", terms: ["عنوان", "title"] },
  { tag: "thumbnail", terms: ["صورة مصغرة", "الثمب", "الغلاف", "thumbnail", "cover"] },
  { tag: "script", terms: ["نص", "سكربت", "محتوى", "كلام", "script", "content"] },
  { tag: "voice", terms: ["صوت", "تعليق", "voice", "narration"] },
  { tag: "music", terms: ["موسيقى", "music", "sound"] },
  { tag: "pacing", terms: ["إيقاع", "بطيء", "سريع", "ممل", "pacing", "slow", "fast"] },
  { tag: "factual", terms: ["معلومة", "مصدر", "خطأ", "غلط", "fact", "source", "wrong"] },
  { tag: "sensitive", terms: ["حساس", "سياسي", "ديني", "سياسة", "sensitive", "political", "religion"] },
];

export const rejectionTagger = defineSkill({
  key: "rejection-tagger",
  version: "1.0.0",
  goal: "Map a free-text rejection reason into stable tags + a short note, so every rejection feeds the learning loop.",
  kind: "code",
  path: "any",
  stages: ["S9"],
  input: Input,
  output: Output,
  checklist: [
    "deterministic keyword mapping (ar+en), no llm",
    "unmatched reasons become tag 'other'",
    "at most 8 tags",
  ],
  examples: [
    { name: "title-too-clickbait", input: { reason: "العنوان مبالغ فيه والصورة المصغرة غير جذابة" }, expectOutput: { tags: ["title", "thumbnail"] } },
    { name: "unknown", input: { reason: "لم يعجبني" }, expectOutput: { tags: ["other"] } },
  ],
  implemented: true,
  async run(_rt, input) {
    const lower = input.reason.toLowerCase();
    const tags = MAP.filter((m) => m.terms.some((t) => lower.includes(t.toLowerCase()))).map((m) => m.tag);
    const finalTags = tags.length ? tags.slice(0, 8) : ["other"];
    return {
      tags: finalTags,
      note: `صُنّف الرفض: ${finalTags.join("، ")} — ${input.reason.slice(0, 200)}`,
    };
  },
});
