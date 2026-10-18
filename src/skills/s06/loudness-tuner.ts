import { z } from "zod";
import { CONFIG } from "@/src/pipeline/config";
import { defineSkill } from "@/src/skills/_types";

export const Input = z.strictObject({
  targetLufs: z.number().max(-5).min(-30),
  measurement: z.strictObject({ available: z.boolean(), lufs: z.number().max(0).min(-60).nullable() }).nullable(),
});

export const Output = z.strictObject({
  lufs: z.number().nullable(),
  ok: z.boolean().nullable(),
  advice: z.string().max(400),
});

export const loudnessTuner = defineSkill({
  key: "loudness-tuner",
  version: "1.0.0",
  goal: "Verify (or, pre-render, document) the loudness target -14 LUFS: measure when a render exists, advise otherwise.",
  kind: "code",
  path: "any",
  stages: ["S6"],
  input: Input,
  output: Output,
  checklist: [
    "ok=null when no measurement exists (pre-render) — never a fake pass",
    "ok=true only within target ± tolerance",
    "advice states the exact gain change when off-target",
  ],
  examples: [
    { name: "no-render-yet", input: { targetLufs: -14, measurement: null }, expectOutput: { ok: null } },
    { name: "off-target", input: { targetLufs: -14, measurement: { available: true, lufs: -9.5 } }, expectOutput: { ok: false } },
  ],
  implemented: true,
  async run(_rt, input) {
    if (!input.measurement || !input.measurement.available || input.measurement.lufs === null) {
      return {
        lufs: null,
        ok: null,
        advice: `لا يوجد ملف مُصيَّر بعد — استهدف ${input.targetLufs} LUFS (±${CONFIG.lufs.tolerance}) عند الخلط، وسيُقاس تلقائياً بعد الرندر`,
      };
    }
    const lufs = input.measurement.lufs;
    const delta = input.targetLufs - lufs;
    const ok = Math.abs(delta) <= CONFIG.lufs.tolerance;
    return {
      lufs,
      ok,
      advice: ok ? `الصوت مطابق (${lufs.toFixed(1)} LUFS)` : `اضبط master gain بمقدار ${delta > 0 ? "+" : ""}${delta.toFixed(1)} dB للوصول إلى ${input.targetLufs} LUFS`,
    };
  },
});
