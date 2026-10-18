import { z } from "zod";
import { defineSkill } from "@/src/skills/_types";
import { jsonPayload, llmJson, rolePrompt } from "@/src/skills/_common";

export const Input = z.strictObject({
  niche: z.string().max(120),
  markets: z.array(z.string().max(12)).min(1).max(10),
  languages: z.array(z.string().max(12)).min(1).max(5),
  recentTitles: z.array(z.string().max(200)).max(50),
});

export const Output = z.strictObject({
  trends: z
    .array(
      z.strictObject({
        topic: z.string().min(3).max(120),
        why: z.string().max(300),
        momentum: z.enum(["rising", "steady", "fading"]),
      }),
    )
    .min(3)
    .max(12),
});

export const trendScout = defineSkill({
  key: "trend-scout",
  version: "1.0.0",
  goal: "Surface 3-12 current topics in the niche with an honest momentum judgement and a reason for each.",
  kind: "llm",
  path: "any",
  stages: ["S2"],
  input: Input,
  output: Output,
  checklist: [
    "at least 3 trends",
    "topics avoid topics already covered in recentTitles",
    "momentum is one of rising/steady/fading",
    "no fabricated statistics in why",
  ],
  examples: [
    { name: "tech-arabic", input: { niche: "تقنية", markets: ["eg", "sa"], languages: ["ar"], recentTitles: ["أفضل 5 هواتف 2026"] } },
  ],
  implemented: true,
  async run(rt, input) {
    const system = rolePrompt(
      "You are a YouTube trend scout. Given a niche, target markets and the channel's recent titles, propose distinct topical angles. " +
        "Prefer ideas the channel has NOT covered. Avoid inventing numbers or statistics; reasons must be qualitative and honest. " +
        "Write topics and reasons in the channel's primary language.",
      Output,
    );
    return llmJson(rt, "trend-scout", {
      system,
      user: `Scout trends:\n${jsonPayload(input)}`,
      schema: Output,
      temperature: 0.8,
    });
  },
});
