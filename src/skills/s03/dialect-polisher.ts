import { z } from "zod";
import { defineSkill } from "@/src/skills/_types";
import { jsonPayload, llmJson, rolePrompt } from "@/src/skills/_common";

export const Input = z.strictObject({
  script: z.string().min(100).max(20000),
  markets: z.array(z.string().max(12)).min(1).max(10),
  tone: z.string().max(200).optional(),
});

export const Output = z.strictObject({
  script: z.string().min(100).max(20000),
  changes: z.array(z.string().max(200)).max(15),
});

export const dialectPolisher = defineSkill({
  key: "dialect-polisher",
  version: "1.0.0",
  goal: "Adapt the script to the target dialect/market register without changing any fact, number or claim.",
  kind: "llm",
  path: "any",
  stages: ["S3"],
  input: Input,
  output: Output,
  checklist: [
    "every number and factual claim of the original survives verbatim",
    "script length stays within ±10% of the original",
    "changes list summarizes what was adapted",
  ],
  examples: [
    { name: "msa-to-egyptian", input: { script: "هل تعلم أن البطاريات تتأثر بالحرارة؟ هذا أمر مهم جداً للمستخدمين.", markets: ["eg"] } },
  ],
  implemented: true,
  async run(rt, input) {
    const system = rolePrompt(
      "You adapt Arabic scripts to a target dialect/market (never translate to another language). Keep EVERY fact, number, name and claim identical. " +
        "Change vocabulary, idioms and rhythm only. List the adaptations in changes.",
      Output,
    );
    return llmJson(rt, "dialect-polisher", {
      system,
      user: `Adapt this script:\n${jsonPayload(input)}`,
      schema: Output,
      temperature: 0.5,
    });
  },
});
