import { z } from "zod";
import { defineSkill } from "@/src/skills/_types";
import { jsonPayload, llmJson, rolePrompt } from "@/src/skills/_common";

export const Input = z.strictObject({
  scenes: z.array(z.strictObject({ id: z.string().max(40), visualPrompt: z.string().min(10).max(1200), mood: z.string().max(120).optional() })).min(1).max(80),
  styleHint: z.string().max(300).optional(),
  usesAvatar: z.boolean(),
});

export const Output = z.strictObject({
  items: z.array(z.strictObject({ sceneId: z.string().max(40), prompt: z.string().min(20).max(1500) })).min(1).max(80),
});

export const scenePromptEngineer = defineSkill({
  key: "scene-prompt-engineer",
  version: "1.0.0",
  goal: "Harden each scene's visual prompt for generation: concrete subject, framing, lighting, style, and explicit negatives.",
  kind: "llm",
  path: "any",
  stages: ["S5"],
  input: Input,
  output: Output,
  checklist: [
    "one output item per input scene, ids preserved",
    "prompts add framing/lighting/style and an explicit negative clause",
    "no brand names, no real people's names",
    "avatar scenes mention consistent character framing when usesAvatar",
  ],
  examples: [
    {
      name: "two-scenes",
      input: { scenes: [{ id: "s1", visualPrompt: "هاتف ساخن على طاولة" }, { id: "s2", visualPrompt: "شاحن قديم" }], usesAvatar: false },
    },
  ],
  implemented: true,
  async run(rt, input) {
    const system = rolePrompt(
      "You engineer image/video generation prompts. Keep the scene's intent; add: shot framing (close-up/wide/overhead), lighting, color palette, art style. " +
        "End every prompt with a short negative clause (no text artifacts, no extra fingers, no logos). Never reference real people or brands. " +
        "Write prompts in English for generators; keep ids identical.",
      Output,
    );
    return llmJson(rt, "scene-prompt-engineer", {
      system,
      user: `Upgrade prompts:\n${jsonPayload(input)}`,
      schema: Output,
      temperature: 0.4,
    });
  },
});
