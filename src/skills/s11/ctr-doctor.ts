import { z } from "zod";
import { defineSkill } from "@/src/skills/_types";

export const Input = z.strictObject({ channelId: z.string().max(60), windowDays: z.number().int().min(7).max(90) });

export const Output = z.strictObject({ ok: z.boolean(), findings: z.array(z.string().max(300)).max(20) });

export const ctrDoctor = defineSkill({
  key: "ctr-doctor",
  version: "1.0.0",
  goal: "Diagnose impressions CTR vs the channel baseline and propose A/B thumbnail+title iterations.",
  kind: "llm",
  path: "any",
  stages: ["S11"],
  input: Input,
  output: Output,
  checklist: ["YouTube Analytics API required", "baseline needs >= 5 videos", "proposals are hypotheses, not guarantees"],
  examples: [{ name: "placeholder", input: { channelId: "chan_1", windowDays: 28 } }],
  implemented: false,
  reason: "wave 2: needs YouTube Analytics API OAuth scopes; the lessons it produces will feed S12 and the KB.",
});
