import { z } from "zod";
import { defineSkill } from "@/src/skills/_types";

export const Input = z.strictObject({
  assetIds: z.array(z.string().max(60)).min(1).max(200),
});

export const Output = z.strictObject({
  ok: z.boolean(),
  findings: z.array(z.string().max(300)).max(50),
});

export const deformityDetector = defineSkill({
  key: "deformity-detector",
  version: "1.0.0",
  goal: "Vision QA over generated assets: hands, faces, text artifacts — reject deformed frames before they cost a re-render.",
  kind: "llm",
  path: "any",
  stages: ["S5"],
  input: Input,
  output: Output,
  checklist: ["vision model required", "checks hands/faces/text artifacts", "blocking findings feed the fallback-picker"],
  examples: [{ name: "placeholder", input: { assetIds: ["asset_1"] } }],
  implemented: false,
  reason: "wave 2: needs a vision-capable model and real generated frames; without media generation there is nothing to inspect.",
});
