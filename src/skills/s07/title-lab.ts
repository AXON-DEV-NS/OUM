import { z } from "zod";
import { defineSkill } from "@/src/skills/_types";
import { jsonPayload, llmJson, rolePrompt } from "@/src/skills/_common";

export const Input = z.strictObject({
  ideaTitle: z.string().min(8).max(120),
  promiseCore: z.string().min(10).max(300),
  market: z.string().max(12),
  recentTitles: z.array(z.string().max(200)).max(30),
});

export const Output = z.strictObject({
  titles: z
    .array(z.strictObject({ text: z.string().min(8).max(100), style: z.string().min(2).max(40), reason: z.string().max(200) }))
    .min(3)
    .max(8),
});

export const titleLab = defineSkill({
  key: "title-lab",
  version: "1.0.0",
  goal: "Produce 3-8 title candidates in different proven styles (curiosity, number, how-to, contrast, warning), all within 100 chars.",
  kind: "llm",
  path: "any",
  stages: ["S7"],
  input: Input,
  output: Output,
  checklist: [
    "3-8 titles, each <= 100 chars, each a different style",
    "no title promises more than promiseCore",
    "titles differ from recentTitles (no near-duplicates)",
  ],
  examples: [
    { name: "battery-heat", input: { ideaTitle: "لماذا تسخن البطاريات؟", promiseCore: "شرح بسيط لسبب السخونة وحل عملي", market: "eg", recentTitles: [] } },
  ],
  implemented: true,
  async run(rt, input) {
    const system = rolePrompt(
      "You are a YouTube title lab. Write title candidates in the market's language. Each title uses a DIFFERENT style: curiosity gap, number/listicle, " +
        "how-to, contrast (before/after), warning/mistake. Max 100 characters — count carefully. Honest curiosity only: never promise what the video does not deliver. " +
        "style names the used style.",
      Output,
    );
    return llmJson(rt, "title-lab", {
      system,
      user: `Write titles:\n${jsonPayload(input)}`,
      schema: Output,
      temperature: 0.9,
    });
  },
});
