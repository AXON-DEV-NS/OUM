import { z } from "zod";
import { defineSkill } from "@/src/skills/_types";
import { jsonPayload, llmJson, rolePrompt } from "@/src/skills/_common";

export const Input = z.strictObject({
  titles: z.array(z.string().max(100)).min(1).max(8),
  concepts: z.array(z.strictObject({ overlayText: z.string().max(60), concept: z.string().max(400) })).min(1).max(4),
  markets: z.array(z.string().max(12)).min(1).max(5),
  avatarDescription: z.string().max(600).optional(),
});

export const Output = z.strictObject({
  artNotes: z.string().min(20).max(1200),
  palette: z.array(z.string().max(20)).min(1).max(6),
  layout: z.string().min(10).max(600),
});

export const designDescriber = defineSkill({
  key: "design-describer",
  version: "1.0.0",
  goal: "Convert the chosen title + thumbnail concepts into an art-direction brief: palette, layout zones and notes for the image generator.",
  kind: "llm",
  path: "any",
  stages: ["S7"],
  input: Input,
  output: Output,
  checklist: [
    "palette has 1-6 entries (hex or named colors)",
    "layout describes where the overlay text sits and the focal point",
    "notes respect brand-neutrality (no real logos)",
  ],
  examples: [
    {
      name: "battery",
      input: { titles: ["لماذا تسخن بطاريات هواتفنا؟"], concepts: [{ overlayText: "سبب مفاجئ", concept: "هاتف ساخن بألوان تحذيرية" }], markets: ["eg"] },
    },
  ],
  implemented: true,
  async run(rt, input) {
    const system = rolePrompt(
      "You art-direct YouTube thumbnails. Extract the shared visual promise of the concepts. Provide a palette (hex codes), a layout " +
        "(focal point, text zone, safe margins), and concrete art notes (lighting, contrast, mood, level of realism).",
      Output,
    );
    return llmJson(rt, "design-describer", {
      system,
      user: `Art-direct these concepts:\n${jsonPayload(input)}`,
      schema: Output,
      temperature: 0.5,
    });
  },
});
