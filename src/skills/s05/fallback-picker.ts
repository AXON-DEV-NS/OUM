import { z } from "zod";
import { FOOTAGE_LIBRARY, pickClip } from "@/src/pipeline/library/manifest";
import { defineSkill } from "@/src/skills/_types";

export const Input = z.strictObject({
  tag: z.string().max(120).optional(),
  risk: z.enum(["high", "low"]),
});

export const Output = z.strictObject({
  fallback: z
    .strictObject({ clipId: z.string().max(60), license: z.string().max(120), filePath: z.string().max(1024).nullable() })
    .nullable(),
  poolSize: z.number().int().min(0),
  advice: z.string().max(300),
});

export const fallbackPicker = defineSkill({
  key: "fallback-picker",
  version: "1.0.0",
  goal: "When a generated shot is risky or rejected, pick a licensed substitute clip from the in-repo library — or say none exists.",
  kind: "code",
  path: "any",
  stages: ["S5"],
  input: Input,
  output: Output,
  checklist: [
    "only licensed library clips are ever returned",
    "empty library -> fallback=null with explicit advice",
    "high-risk requests surface the missing-license problem instead of faking it",
  ],
  examples: [
    { name: "empty-pool", input: { tag: "city", risk: "high" }, expectOutput: { fallback: null, poolSize: 0 } },
  ],
  implemented: true,
  async run(_rt, input) {
    const clip = pickClip(input.tag);
    if (!clip) {
      return {
        fallback: null,
        poolSize: FOOTAGE_LIBRARY.length,
        advice:
          input.risk === "high"
            ? "لا توجد لقطة بديلة مرخصة — أضف مقاطع مرخصة للمكتبة أو حسّن الأمر الأصلي وأعد التوليد"
            : "لا توجد لقطة بديلة مرخصة — استمر بالتوليد العادي",
      };
    }
    return {
      fallback: { clipId: clip.id, license: clip.license, filePath: clip.filePath ?? null },
      poolSize: FOOTAGE_LIBRARY.length,
      advice: `بديل مرخص من المكتبة (${clip.license})`,
    };
  },
});
