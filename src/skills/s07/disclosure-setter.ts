import { z } from "zod";
import { defineSkill } from "@/src/skills/_types";

export const Input = z.strictObject({
  hasSyntheticMedia: z.boolean(),
  hasSyntheticVoice: z.boolean(),
  locale: z.string().min(2).max(12),
});

export const Output = z.strictObject({
  disclosure: z.strictObject({ required: z.boolean(), text: z.string().max(400) }),
});

const TEXT: Record<string, string> = {
  ar: "يحتوي هذا الفيديو على مشاهد وصوت مولّدين أو معدّلين بالذكاء الاصطناعي.",
  en: "This video contains visuals and audio generated or altered with AI.",
};

export const disclosureSetter = defineSkill({
  key: "disclosure-setter",
  version: "1.0.0",
  goal: "Set the AI-content disclosure deterministically: required whenever synthetic media/voice is used, with localized fixed text.",
  kind: "code",
  path: "any",
  stages: ["S7"],
  input: Input,
  output: Output,
  checklist: [
    "required=true when any synthetic media or voice is present",
    "text is non-empty and localized (ar/en fallback)",
    "no disclosure when nothing synthetic is used",
  ],
  examples: [
    { name: "avatar-run", input: { hasSyntheticMedia: true, hasSyntheticVoice: true, locale: "ar" }, expectOutput: { disclosure: { required: true } } },
    { name: "pure-code-text", input: { hasSyntheticMedia: false, hasSyntheticVoice: false, locale: "ar" }, expectOutput: { disclosure: { required: false } } },
  ],
  implemented: true,
  async run(_rt, input) {
    const required = input.hasSyntheticMedia || input.hasSyntheticVoice;
    const lang = input.locale.startsWith("ar") ? "ar" : "en";
    return { disclosure: { required, text: required ? TEXT[lang] : "" } };
  },
});
