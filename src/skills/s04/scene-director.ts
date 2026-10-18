import { z } from "zod";
import { SceneSchema } from "@/src/pipeline/schemas/storyboard";
import { defineSkill } from "@/src/skills/_types";
import { jsonPayload, llmJson, rolePrompt } from "@/src/skills/_common";

export const Input = z.strictObject({
  script: z.string().min(100).max(20000),
  structure: z.array(z.strictObject({ name: z.string().max(60), seconds: z.number().int().min(3).max(600) })).min(3).max(20),
  targetMinutes: z.number().min(0.5).max(60),
  usesAvatar: z.boolean(),
  markets: z.array(z.string().max(12)).min(1).max(10),
});

export const Output = z.strictObject({
  scenes: z.array(SceneSchema).min(4).max(80),
  onScreenText: z.array(z.string().max(120)).max(60),
});

export const sceneDirector = defineSkill({
  key: "scene-director",
  version: "1.0.0",
  goal: "Turn the script + retention beats into a shot-by-shot storyboard with per-scene visual prompts.",
  kind: "llm",
  path: "any",
  stages: ["S4"],
  input: Input,
  output: Output,
  checklist: [
    "4-80 scenes, ids s1..sN, indexes sequential",
    "scene narration comes verbatim from the script (sliced, not rewritten)",
    "scene seconds sum within ±15% of target runtime",
    "requiresAvatar=false for every scene on faceless runs",
    "visualPrompt is concrete (subject, framing, light, style) and >= 10 chars",
  ],
  examples: [
    {
      name: "faceless-short",
      input: {
        script: "هوك قصير ثم مقدمة ثم تفاصيل ثم خاتمة.".padEnd(120, " نص"),
        structure: [{ name: "هوك", seconds: 10 }, { name: "محتوى", seconds: 120 }, { name: "خاتمة", seconds: 20 }],
        targetMinutes: 2.5,
        usesAvatar: false,
        markets: ["eg"],
      },
    },
  ],
  implemented: true,
  async run(rt, input) {
    const system = rolePrompt(
      "You are a video director. Slice the script into scenes (each 3-20 seconds of narration) following the retention beats. " +
        "narration MUST be the exact script text of that slice. visualPrompt = concrete shot description for image/video generation " +
        "(subject, framing, lighting, style words, no brand names). requiresAvatar true ONLY if the narration shows the host on camera " +
        "and the run uses an avatar. onScreenText holds short overlay phrases (<= 6 words each).",
      Output,
    );
    return llmJson(rt, "scene-director", {
      system,
      user: `Build the storyboard:\n${jsonPayload(input)}`,
      schema: Output,
      temperature: 0.6,
    });
  },
});
