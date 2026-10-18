import { z } from "zod";
import { defineSkill } from "@/src/skills/_types";
import { jsonPayload, llmJson, rolePrompt } from "@/src/skills/_common";

export const Input = z.strictObject({
  title: z.string().min(8).max(100),
  ideaAngle: z.string().min(10).max(400),
  audienceSummary: z.string().max(600),
  beats: z.array(z.string().max(200)).min(1).max(20),
  chapters: z.array(z.strictObject({ at: z.string().max(10), label: z.string().max(120) })).max(40),
  markets: z.array(z.string().max(12)).min(1).max(10),
  trends: z.array(z.string().max(200)).max(12),
});

export const Output = z.strictObject({
  description: z.string().min(80).max(5000),
  tags: z.array(z.string().min(2).max(60)).max(30),
});

export const seoWriter = defineSkill({
  key: "seo-writer",
  version: "1.0.0",
  goal: "Write the YouTube description (hook paragraph + value bullets + chapters block) and up to 30 tags.",
  kind: "llm",
  path: "any",
  stages: ["S7"],
  input: Input,
  output: Output,
  checklist: [
    "description >= 80 and <= 5000 chars (validated in code)",
    "description opens with a benefit-led line, then bullets, then the chapters block",
    "chapters (when present) appear verbatim as 'timestamp label' lines inside the description",
    "tags <= 30, no #hashtag spam, no misleading terms",
  ],
  examples: [
    {
      name: "with-chapters",
      input: {
        title: "لماذا تسخن البطاريات؟",
        ideaAngle: "سبب السخونة وحل عملي",
        audienceSummary: "مستخدمون عاديون",
        beats: ["لماذا", "الأسباب", "الحل"],
        chapters: [{ at: "0:00", label: "البداية" }, { at: "1:10", label: "الأسباب" }],
        markets: ["eg"],
        trends: [],
      },
    },
  ],
  implemented: true,
  async run(rt, input) {
    const system = rolePrompt(
      "You write YouTube descriptions: first line = benefit-led summary with the main keyword; then 3-6 short value bullets; " +
        "when chapters are provided, append them verbatim (format 'at label' one per line). End with a light CTA. " +
        "Tags: up to 30 relevant phrases, no spam, never misleading. Write in the market's language.",
      Output,
    );
    return llmJson(rt, "seo-writer", {
      system,
      user: `Write description + tags:\n${jsonPayload(input)}`,
      schema: Output,
      temperature: 0.6,
    });
  },
});
