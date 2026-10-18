/**
 * Scheduling determinism: gap conflicts between runs on one channel and
 * default time-slot selection until real analytics exist (wave 2).
 */
import { CONFIG } from "@/src/pipeline/config";
import { fail, ok, type CheckOutcome, type DeterministicCheck } from "./index";

export function hasConflict(target: Date, existing: Date[], minGapHours: number = CONFIG.schedule.minGapHours): Date | null {
  const gapMs = minGapHours * 3600_000;
  for (const d of existing) {
    if (Math.abs(target.getTime() - d.getTime()) < gapMs) return d;
  }
  return null;
}

/** next candidate publication instant after `after` (UTC slots, then +offset) */
export function nextSlot(after: Date, slotsUtc: number[] = [...CONFIG.schedule.defaultSlotsUtc]): Date {
  const slots = [...slotsUtc].sort((a, b) => a - b);
  for (let day = 0; day <= 2; day++) {
    for (const h of slots) {
      const candidate = new Date(Date.UTC(after.getUTCFullYear(), after.getUTCMonth(), after.getUTCDate() + day, h, 0, 0));
      if (candidate.getTime() - after.getTime() >= 5 * 60_000) return candidate; // at least 5 min ahead
    }
  }
  return new Date(after.getTime() + CONFIG.schedule.defaultOffsetMinutes * 60_000);
}

export const checkScheduleGap: DeterministicCheck<{ target: Date; existing: Date[] }> = {
  key: "schedule.gap",
  run({ target, existing }): CheckOutcome {
    const conflict = hasConflict(target, existing);
    if (conflict) {
      return fail("schedule.gap", `publishing ${target.toISOString()} conflicts with another run at ${conflict.toISOString()} (< ${CONFIG.schedule.minGapHours}h apart)`, {
        fix: "move the publication to the next free slot",
      });
    }
    return ok("schedule.gap");
  },
};

export const checkScheduleNotPast: DeterministicCheck<{ target: Date; now?: Date }> = {
  key: "schedule.not-past",
  run({ target, now }): CheckOutcome {
    const ref = now ?? new Date();
    if (target.getTime() < ref.getTime() - 60_000) return fail("schedule.not-past", `scheduled time ${target.toISOString()} is in the past`);
    return ok("schedule.not-past");
  },
};
