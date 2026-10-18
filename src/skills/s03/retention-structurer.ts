import { z } from "zod";
import { RetentionBeatSchema } from "@/src/pipeline/schemas/script";
import { defineSkill } from "@/src/skills/_types";
import { jsonPayload, llmJson, rolePrompt } from "@/src/skills/_common";

export const Input = z.strictObject({
  script: z.string().min(100).max(20000),
  targetMinutes: z.number().min(0.5).max(60),
});

export const Output = z.strictObject({
  structure: z.array(RetentionBeatSchema).min(3).max(20),
  revisedScript: z.string().min(100).max(20000).optional(),
});

export const retentionStructurer = defineSkill({
  key: "retention-structurer",
  version: "1.0.0",
  goal: "Slice the script into retention beats with seconds budgets summing to the target runtime, tightening weak transitions.",
  kind: "llm",
  path: "any",
  stages: ["S3"],
  input: Input,
  output: Output,
  checklist: [
    "beats have positive seconds; the stage validates the sum against target runtime (±15%)",
    "each beat has a purpose-oriented name",
    "revisedScript, when present, keeps every factual claim of the original",
  ],
  examples: [
    { name: "three-minute-script", input: { script: "هوك: هل تعلم أن...؟\n\nالمقدمة...\n\nالخاتمة...".padEnd(150, " نص"), targetMinutes: 3 } },
  ],
  implemented: true,
  async run(rt, input) {
    const system = rolePrompt(
      "You structure YouTube scripts for retention. Produce 4-8 beats covering the whole script; seconds must sum to targetMinutes*60 (±10%). " +
        "revisedScript is optional: include it only if you tightened the script, and never add or drop factual claims.",
      Output,
    );
    return llmJson(rt, "retention-structurer", {
      system,
      user: `Structure this script:\n${jsonPayload(input)}`,
      schema: Output,
      temperature: 0.5,
    });
  },
});
