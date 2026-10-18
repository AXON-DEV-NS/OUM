import { z } from "zod";
import { IdeaSchema } from "@/src/pipeline/schemas/script";
import { defineSkill } from "@/src/skills/_types";
import { jsonPayload, llmJson, rolePrompt } from "@/src/skills/_common";

export const Input = z.strictObject({
  idea: IdeaSchema,
  audienceSummary: z.string().max(600),
  /** compiled DNA rules as "kind: text" lines the writer must obey */
  rules: z.array(z.string().max(420)).max(60),
  chosenHook: z.string().min(8).max(140),
  targetMinutes: z.number().min(0.5).max(60),
  markets: z.array(z.string().max(12)).min(1).max(10),
});

export const Output = z.strictObject({ script: z.string().min(200).max(20000) });

export const nicheWriter = defineSkill({
  key: "niche-writer",
  version: "1.0.0",
  goal: "Write the full narration script: chosen hook first, spoken-language style, every hard rule obeyed, no placeholders.",
  kind: "llm",
  path: "any",
  stages: ["S3"],
  input: Input,
  output: Output,
  checklist: [
    "script >= 200 chars and free of placeholders (stage checks TODO/TBD/...)",
    "hard rules from the DNA are obeyed (brand-rules-enforcer verifies in code)",
    "speaking pace fits target minutes at 100-200 words/min",
    "the chosen hook is the opening",
  ],
  examples: [
    {
      name: "short-tech",
      input: {
        idea: { title: "لماذا تسخن البطاريات؟", angle: "شرح مبسط", targetAudience: "مستخدمون عاديون" },
        audienceSummary: "مستخدمون يشكون من سخونة الهاتف",
        rules: ["forbidden: «مجاناً»"],
        chosenHook: "هاتفك بيسخن؟ السبب مش اللي بتظنّه.",
        targetMinutes: 3,
        markets: ["eg"],
      },
    },
  ],
  implemented: true,
  async run(rt, input) {
    const system = rolePrompt(
      "You write YouTube narration scripts in spoken language (not formal essays). Start with the exact chosen hook. " +
        "Obey every rule listed (rules starting with 'forbidden:' must not appear — including quoted terms; 'required:' must appear). " +
        "No placeholders like TODO. No claims that need sources unless you stick to general knowledge. " +
        "Match the target duration by keeping the word count in the 100-200 words-per-minute band of the language.",
      Output,
    );
    return llmJson(rt, "niche-writer", {
      system,
      user: `Write the script:\n${jsonPayload(input)}`,
      schema: Output,
      temperature: 0.8,
    });
  },
});
