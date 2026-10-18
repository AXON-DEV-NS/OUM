import { z } from "zod";
import { ThumbnailConceptSchema } from "@/src/pipeline/schemas/seo";
import { defineSkill } from "@/src/skills/_types";
import { jsonPayload, llmJson, rolePrompt } from "@/src/skills/_common";

export const Input = z.strictObject({
  ideaTitle: z.string().min(8).max(120),
  promiseCore: z.string().min(10).max(300),
  market: z.string().max(12),
});

export const Output = z.strictObject({
  concepts: z.array(ThumbnailConceptSchema).min(2).max(4),
});

export const thumbnailCopywriter = defineSkill({
  key: "thumbnail-copywriter",
  version: "1.0.0",
  goal: "Write 2-4 thumbnail concepts: overlay text of at most 4 words plus a visual concept and an image-generation prompt.",
  kind: "llm",
  path: "any",
  stages: ["S7"],
  input: Input,
  output: Output,
  checklist: [
    "2-4 concepts",
    "overlayText is at most 4 words (validated in code downstream)",
    "each concept complements — not repeats — the title",
    "prompt avoids real faces/brands; text-limited composition",
  ],
  examples: [
    { name: "battery-heat", input: { ideaTitle: "لماذا تسخن البطاريات؟", promiseCore: "سبب السخونة وحل عملي", market: "eg" } },
  ],
  implemented: true,
  async run(rt, input) {
    const system = rolePrompt(
      "You design YouTube thumbnails. overlayText = 2-4 punchy words (NOT a sentence). concept = the visual idea in one sentence. " +
        "prompt = generation prompt for a 16:9 image with strong focal contrast; leave clear space for the overlay text; no brand logos, no real people. " +
        "The concept must add information beyond the title, not repeat it.",
      Output,
    );
    return llmJson(rt, "thumbnail-copywriter", {
      system,
      user: `Design thumbnails:\n${jsonPayload(input)}`,
      schema: Output,
      temperature: 0.8,
    });
  },
});
