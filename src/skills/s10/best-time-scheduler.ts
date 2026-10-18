import { z } from "zod";
import { CONFIG } from "@/src/pipeline/config";
import { hasConflict, nextSlot } from "@/src/pipeline/checks/schedule";
import { defineSkill } from "@/src/skills/_types";

export const Input = z.strictObject({
  nowIso: z.string().max(40),
  existingTimesIso: z.array(z.string().max(40)).max(60),
  preferredIso: z.string().max(40).nullable(),
});

export const Output = z.strictObject({
  scheduledForIso: z.string().max(40),
  rationale: z.string().max(400),
});

export const bestTimeScheduler = defineSkill({
  key: "best-time-scheduler",
  version: "1.0.0",
  goal: "Choose the publication instant: preferred time if conflict-free, else the next free default slot with a human-readable rationale.",
  kind: "code",
  path: "any",
  stages: ["S10"],
  input: Input,
  output: Output,
  checklist: [
    "preferred time is used only when it has no conflict within minGapHours",
    "fallback walks default UTC slots day by day (max 6 tries)",
    "rationale explains why the chosen time was picked",
  ],
  examples: [
    { name: "no-preference", input: { nowIso: "2026-10-18T10:00:00.000Z", existingTimesIso: [], preferredIso: null } },
  ],
  implemented: true,
  async run(_rt, input) {
    const now = new Date(input.nowIso);
    const existing = input.existingTimesIso.map((s) => new Date(s));

    if (input.preferredIso) {
      const preferred = new Date(input.preferredIso);
      if (!Number.isNaN(preferred.getTime()) && preferred.getTime() > now.getTime()) {
        const conflict = hasConflict(preferred, existing);
        if (!conflict) {
          return { scheduledForIso: preferred.toISOString(), rationale: "الموعد المفضل للعميل خالي من التعارض" };
        }
        return {
          scheduledForIso: pick(now, existing),
          rationale: `الموعد المفضل يتعارض مع جدولة أخرى (${conflict.toISOString()}) — تم اختيار أقرب فتحة متاحة`,
        };
      }
    }
    return {
      scheduledForIso: pick(now, existing),
      rationale: `أقرب فتحة من الفتحات الافتراضية (${CONFIG.schedule.defaultSlotsUtc.join("/")} UTC) بعد فحص التعارضات`,
    };
  },
});

function pick(now: Date, existing: Date[]): string {
  let candidate = nextSlot(now);
  for (let i = 0; i < 6; i++) {
    if (!hasConflict(candidate, existing)) return candidate.toISOString();
    candidate = nextSlot(new Date(candidate.getTime() + 30 * 60_000));
  }
  return new Date(now.getTime() + CONFIG.schedule.defaultOffsetMinutes * 60_000).toISOString();
}
