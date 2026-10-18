import { z } from "zod";
import { defineSkill } from "@/src/skills/_types";
import { jsonPayload, llmJson, rolePrompt } from "@/src/skills/_common";

export const Input = z.strictObject({
  nicheKey: z.string().min(2).max(120),
  runSummary: z.strictObject({
    title: z.string().max(140),
    stageScores: z.record(z.string().max(8), z.number().int().min(0).max(100)),
    failures: z.array(z.string().max(300)).max(30),
    warnings: z.array(z.string().max(300)).max(30),
    rejectionTags: z.array(z.string().max(40)).max(10),
    postPublishFindings: z.array(z.string().max(300)).max(30),
    costCents: z.number().int().min(0),
  }),
});

export const Output = z.strictObject({
  lessons: z
    .array(
      z.strictObject({
        lesson: z.string().min(10).max(240),
        evidenceText: z.string().min(5).max(300),
        confidence: z.number().int().min(1).max(5),
      }),
    )
    .min(1)
    .max(6),
});

export const lessonExtractor = defineSkill({
  key: "lesson-extractor",
  version: "1.0.0",
  goal: "Distill this run's evidence (failures, warnings, rejections, post-publish findings) into 1-6 reusable niche lessons.",
  kind: "llm",
  path: "any",
  stages: ["S12"],
  input: Input,
  output: Output,
  checklist: [
    "lessons are evidence-based, each with evidenceText quoting this run",
    "no lesson is invented without a matching failure/warning/finding",
    "lesson <= 240 chars, actionable next time",
    "confidence 1-5 reflects strength of evidence",
  ],
  examples: [
    {
      name: "one-failure",
      input: {
        nicheKey: "تقنية",
        runSummary: {
          title: "لماذا تسخن البطاريات؟",
          stageScores: { S8: 74 },
          failures: ["عنوان أطول من 100 حرف في أول محاولة"],
          warnings: [],
          rejectionTags: [],
          postPublishFindings: [],
          costCents: 240,
        },
      },
    },
  ],
  implemented: true,
  async run(rt, input) {
    const system = rolePrompt(
      "You distill production lessons for a content niche from ONE run's evidence. Only turn actual recorded failures/warnings/rejections/findings into lessons. " +
        "A lesson must be actionable next time ('keep titles under 100 chars', not 'be careful'). evidenceText quotes the concrete evidence. " +
        "confidence: 1=weak signal, 3=solid, 5=repeated pattern.",
      Output,
    );
    return llmJson(rt, "lesson-extractor", {
      system,
      user: `Extract lessons:\n${jsonPayload(input)}`,
      schema: Output,
      temperature: 0.3,
    });
  },
});
