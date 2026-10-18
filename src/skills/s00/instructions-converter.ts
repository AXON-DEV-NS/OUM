import { z } from "zod";
import { RuleSchema } from "@/src/pipeline/schemas/dna";
import { defineSkill } from "@/src/skills/_types";
import { jsonPayload, llmJson, rolePrompt } from "@/src/skills/_common";

export const Input = z.strictObject({
  instructions: z.string().max(6000),
  channelTitle: z.string().min(1).max(200),
  niche: z.string().max(120).optional(),
  markets: z.array(z.string().max(12)).min(1).max(10),
  tone: z.string().max(200).optional(),
});

export const Output = z.strictObject({
  rules: z.array(RuleSchema).min(3).max(60),
  notes: z.array(z.string().max(300)).max(10),
});

export const instructionsConverter = defineSkill({
  key: "instructions-converter",
  version: "1.0.0",
  goal: "Convert raw client instructions and the channel profile into structured, machine-checkable content rules.",
  kind: "llm",
  path: "any",
  stages: ["S0"],
  input: Input,
  output: Output,
  checklist: [
    "at least 3 rules are produced",
    "every rule has id, text, kind, source and hard",
    "forbidden rules quote the banned term in «...» or \"...\"",
    "no two rules are near-duplicates",
  ],
  examples: [
    {
      name: "arabic-tech-channel",
      input: { instructions: "لا تستخدم كلمة «مجاناً». ابدأ كل فيديو بسؤال. مدة الفيديو 3 دقائق.", channelTitle: "تقنية بالعربي", markets: ["eg", "sa"], tone: "ودي" },
    },
  ],
  implemented: true,
  async run(rt, input) {
    const system = rolePrompt(
      "You compile YouTube content rules from client instructions. kinds: tone, format, forbidden, required, audience, style. " +
        "For forbidden rules, quote the banned term inside the text like «term». source=\"instruction\" unless it comes from the platform profile. " +
        "hard=true only when breaking the rule would be unacceptable to the client. Use short ids r1, r2, ...",
      Output,
    );
    return llmJson(rt, "instructions-converter", {
      system,
      user: `Channel and raw instructions:\n${jsonPayload(input)}`,
      schema: Output,
      temperature: 0.3,
    });
  },
});
