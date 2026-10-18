import { z } from "zod";
import { defineSkill } from "@/src/skills/_types";
import { jsonPayload, llmJson, rolePrompt } from "@/src/skills/_common";

export const Input = z.strictObject({
  scenes: z.array(z.strictObject({ id: z.string().max(40), narration: z.string().max(600) })).min(4).max(80),
  markets: z.array(z.string().max(12)).min(1).max(10),
  tone: z.string().max(200).optional(),
});

export const Output = z.strictObject({
  voice: z.strictObject({
    style: z.string().min(3).max(300),
    rateWpm: z.number().int().min(90).max(220),
    emphasisNotes: z.array(z.string().max(200)).max(40),
  }),
});

export const voiceDirector = defineSkill({
  key: "voice-director",
  version: "1.0.0",
  goal: "Define the TTS direction: voice style, speaking rate and per-passage emphasis so narration sounds directed, not robotic.",
  kind: "llm",
  path: "any",
  stages: ["S4"],
  input: Input,
  output: Output,
  checklist: [
    "rateWpm within 90-220",
    "style names gender-free delivery traits (warm, energetic...) not a specific person",
    "emphasis notes reference scenes by id",
  ],
  examples: [
    {
      name: "warm-tech",
      input: { scenes: [{ id: "s1", narration: "هاتفك بيسخن؟" }, { id: "s2", narration: "السبب بسيط." }, { id: "s3", narration: "الحل خطوتان." }, { id: "s4", narration: "جرّبها." }], markets: ["eg"], tone: "ودي" },
    },
  ],
  implemented: true,
  async run(rt, input) {
    const system = rolePrompt(
      "You direct text-to-speech narration. Choose a delivery style described generically (energy, warmth, pacing), a speaking rate in words per minute " +
        "that fits the language (Arabic news ~150, conversational ~170), and emphasis notes per scene id (which words to stress).",
      Output,
    );
    return llmJson(rt, "voice-director", {
      system,
      user: `Direct the narration:\n${jsonPayload(input)}`,
      schema: Output,
      temperature: 0.4,
    });
  },
});
