import { z } from "zod";
import { defineSkill } from "@/src/skills/_types";
import { jsonPayload, llmJson, rolePrompt } from "@/src/skills/_common";

export const Input = z.strictObject({
  ideaTitle: z.string().min(8).max(120),
  angle: z.string().min(10).max(400),
  audienceSummary: z.string().max(600),
  tone: z.string().max(200).optional(),
  markets: z.array(z.string().max(12)).min(1).max(10),
});

export const Output = z.strictObject({
  hooks: z.array(z.string().min(8).max(140)).min(3).max(6),
});

export const hookWriter = defineSkill({
  key: "hook-writer",
  version: "1.0.0",
  goal: "Write 3-6 distinct opening hooks (first 5 seconds) for the chosen idea, each with a different psychological angle.",
  kind: "llm",
  path: "any",
  stages: ["S3"],
  input: Input,
  output: Output,
  checklist: [
    "3-6 hooks, all <= 140 chars",
    "each hook takes a different angle (question, stat, contrast, story, warning)",
    "no clickbait that the script cannot deliver",
  ],
  examples: [
    { name: "budget-phones", input: { ideaTitle: "أفضل 5 هواتف 2026", angle: "مقارنة فئة متوسطة", audienceSummary: "شباب ميزانية محدودة", markets: ["eg"] } },
  ],
  implemented: true,
  async run(rt, input) {
    const system = rolePrompt(
      "You write YouTube hooks: the first spoken sentence. Each hook must be under 140 characters, concrete, and take a DIFFERENT angle " +
        "(question / counter-intuitive fact / contrast / micro-story / warning). No promises the video cannot keep. Write in the channel's primary language.",
      Output,
    );
    return llmJson(rt, "hook-writer", {
      system,
      user: `Write hooks for:\n${jsonPayload(input)}`,
      schema: Output,
      temperature: 0.9,
    });
  },
});
