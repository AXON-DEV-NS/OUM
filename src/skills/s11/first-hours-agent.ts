import { z } from "zod";
import { defineSkill } from "@/src/skills/_types";

export const Input = z.strictObject({ videoId: z.string().max(60), stageKey: z.string().max(8) });

export const Output = z.strictObject({ ok: z.boolean(), issues: z.array(z.string().max(300)).max(10) });

export const firstHoursAgent = defineSkill({
  key: "first-hours-agent",
  version: "1.0.0",
  goal: "Watch the first hours after publication: comments sentiment, early engagement signals, and flag anomalies for a human.",
  kind: "llm",
  path: "any",
  stages: ["S11"],
  input: Input,
  output: Output,
  checklist: ["YouTube comments API required", "never auto-replies in wave 1", "anomalies become notifications"],
  examples: [{ name: "placeholder", input: { videoId: "abc", stageKey: "S11" } }],
  implemented: false,
  reason: "wave 2: needs the YouTube Data API (comments) with quota budgeting; the port and stage timeline already reserve its slot.",
});
