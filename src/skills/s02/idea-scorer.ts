import { z } from "zod";
import { IdeaSchema } from "@/src/pipeline/schemas/script";
import { defineSkill } from "@/src/skills/_types";
import { jsonPayload, llmJson, rolePrompt } from "@/src/skills/_common";

export const Input = z.strictObject({
  niche: z.string().max(120),
  audienceSummary: z.string().max(600),
  trends: z.array(z.string().max(200)).min(1).max(12),
  recentTitles: z.array(z.string().max(200)).max(50),
  howMany: z.number().int().min(3).max(10),
});

export const Output = z.strictObject({
  ideas: z
    .array(
      IdeaSchema.extend({
        score: z.number().int().min(0).max(100),
        reasons: z.array(z.string().max(200)).max(4),
      }),
    )
    .min(3)
    .max(10),
  recommendation: z.strictObject({ title: z.string().min(8).max(120), why: z.string().max(400) }),
});

export const ideaScorer = defineSkill({
  key: "idea-scorer",
  version: "1.0.0",
  goal: "Generate candidate video ideas and score them 0-100, with the recommended one justified against the audience model.",
  kind: "llm",
  path: "any",
  stages: ["S2"],
  input: Input,
  output: Output,
  checklist: [
    "between 3 and howMany ideas",
    "every idea carries a 0-100 score and reasons",
    "scores differentiate ideas (not all identical)",
    "recommendation title matches one of the ideas",
  ],
  examples: [
    {
      name: "three-ideas",
      input: { niche: "تقنية", audienceSummary: "شباب يتابعون الجديد بأقل ميزانية", trends: ["هواتف متوسطة"], recentTitles: [], howMany: 3 },
    },
  ],
  implemented: true,
  async run(rt, input) {
    const system = rolePrompt(
      "You generate and score YouTube video ideas. Score = likely CTR x retention potential x fit with the audience pains/desires x originality vs recent titles. " +
        "Differentiate scores. Recommendation must name the winning idea. Write in the channel's primary language.",
      Output,
    );
    return llmJson(rt, "idea-scorer", {
      system,
      user: `Generate ${input.howMany} ideas:\n${jsonPayload(input)}`,
      schema: Output,
      temperature: 0.8,
    });
  },
});
