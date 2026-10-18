import { z } from "zod";
import { ClaimSchema } from "@/src/pipeline/schemas/script";
import { defineSkill } from "@/src/skills/_types";
import { jsonPayload, llmJson, rolePrompt } from "@/src/skills/_common";

export const Input = z.strictObject({ script: z.string().min(100).max(20000) });

export const Output = z.strictObject({
  claims: z.array(ClaimSchema).max(30),
});

export const claimsExtractor = defineSkill({
  key: "claims-extractor",
  version: "1.0.0",
  goal: "Extract every checkable claim from the script and mark which ones need a source (facts, statistics, medical, financial, legal).",
  kind: "llm",
  path: "any",
  stages: ["S3"],
  input: Input,
  output: Output,
  checklist: [
    "opinions are marked kind=opinion, needsSource=false",
    "numbers/statistics/medical/financial/legal claims get needsSource=true",
    "claims quote the script text (no paraphrased inventions)",
  ],
  examples: [
    { name: "mixed-claims", input: { script: "٧٠٪ من المستخدمين يعانون من سخونة الهاتف. برأيي المشكلة في الشواحن الرخيصة.".padEnd(120, " ") } },
  ],
  implemented: true,
  async run(rt, input) {
    const system = rolePrompt(
      "You extract checkable claims from a script. kind: fact|statistic|medical|financial|legal|opinion. " +
        "needsSource=true for anything a viewer could demand proof of (numbers, health, money, law). Personal opinions are kind=opinion, needsSource=false. " +
        "Quote the exact script passage in text.",
      Output,
    );
    return llmJson(rt, "claims-extractor", {
      system,
      user: `Extract claims:\n${jsonPayload(input)}`,
      schema: Output,
      temperature: 0.2,
    });
  },
});
