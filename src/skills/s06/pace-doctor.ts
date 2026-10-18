import { z } from "zod";
import { defineSkill } from "@/src/skills/_types";
import { jsonPayload, llmJson, rolePrompt } from "@/src/skills/_common";

export const Input = z.strictObject({
  clips: z
    .array(z.strictObject({ sceneId: z.string().max(40), seconds: z.number().min(1).max(300), narrationChars: z.number().int().min(0).max(5000) }))
    .min(1)
    .max(200),
  targetMinutes: z.number().min(0.5).max(60),
});

export const Output = z.strictObject({
  verdict: z.enum(["ok", "adjust"]),
  suggestions: z.array(z.strictObject({ sceneId: z.string().max(40), addSeconds: z.number().min(-30).max(30), reason: z.string().max(300) })).max(20),
  notes: z.string().max(600),
});

export const paceDoctor = defineSkill({
  key: "pace-doctor",
  version: "1.0.0",
  goal: "Review the edit list's pacing: identify scenes too rushed or too slow for their narration density and propose concrete second adjustments.",
  kind: "llm",
  path: "any",
  stages: ["S6"],
  input: Input,
  output: Output,
  checklist: [
    "verdict=adjust only when concrete per-scene changes are proposed",
    "adjustments stay within ±30s per scene",
    "reason references reading speed vs scene length",
  ],
  examples: [
    {
      name: "dense-scene",
      input: { clips: [{ sceneId: "s1", seconds: 4, narrationChars: 140 }, { sceneId: "s2", seconds: 20, narrationChars: 80 }], targetMinutes: 1 },
    },
  ],
  implemented: true,
  async run(rt, input) {
    const system = rolePrompt(
      "You are a pacing doctor for short-form YouTube edits. Estimate reading speed ~12-16 chars/second for Arabic narration. " +
        "Flag scenes where the narration cannot fit (rushed) or where a short line fills a long scene (dead air). " +
        "verdict=ok when the timeline is healthy. Propose addSeconds (negative shrinks) per problem scene only.",
      Output,
    );
    return llmJson(rt, "pace-doctor", {
      system,
      user: `Diagnose pacing:\n${jsonPayload(input)}`,
      schema: Output,
      temperature: 0.3,
    });
  },
});
