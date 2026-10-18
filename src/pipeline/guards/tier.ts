/**
 * Tier guard — the heart of "Fail Early / Fail Cheap".
 *
 * Rule: a stage may only run when EVERY earlier stage is PASSED or SKIPPED.
 * Additionally, the publish tier requires the final QA stage to have passed
 * with a score at or above the configured threshold.
 * This is what makes it impossible to burn video-tier money on a run whose
 * script or QA is still red.
 */
import { CONFIG } from "../config";
import type { RunRecord, StageRecord } from "../store";
import type { CostTier, StageDefinition } from "../stage";

export const TIER_RANK: Record<CostTier, number> = { free: 0, text: 1, image: 2, video: 3, publish: 4 };

/**
 * Conservative budget floors per tier (cents) for pre-entry affordability
 * checks. Real per-call estimates happen inside the skills; these floors stop
 * obviously-doomed runs before they start.
 */
export const TIER_FLOOR_CENTS: Record<CostTier, number> = { free: 0, text: 1, image: 40, video: 260, publish: 0 };

export interface TierCheckResult {
  pass: boolean;
  code?: string;
  reason?: string;
}

export function checkTierEntry(def: StageDefinition, priorStages: StageRecord[], run: RunRecord): TierCheckResult {
  const blocking = priorStages.filter((s) => s.index < def.index && s.status !== "PASSED" && s.status !== "SKIPPED");
  if (blocking.length > 0) {
    return {
      pass: false,
      code: "GATE_BLOCKED",
      reason: `earlier stages not passed: ${blocking.map((s) => `${s.stageKey}:${s.status}`).join(", ")}`,
    };
  }

  if (def.costTier === "publish") {
    const qa = priorStages.find((s) => s.stageKey === "S8");
    const forced = (qa?.checkpoint as { _forced?: boolean } | undefined)?._forced === true;
    const qaOk = qa?.status === "PASSED" && (forced || (qa.score ?? 0) >= CONFIG.qa.passScore);
    if (!qaOk) {
      return {
        pass: false,
        code: "GATE_BLOCKED",
        reason: `publish tier requires S8 PASSED with score >= ${CONFIG.qa.passScore} (got ${qa?.status ?? "missing"}/${qa?.score ?? "-"})`,
      };
    }
    const approval = priorStages.find((s) => s.stageKey === "S9");
    if (approval?.status !== "PASSED") {
      return { pass: false, code: "GATE_BLOCKED", reason: `publish tier requires human approval (S9) first (got ${approval?.status ?? "missing"})` };
    }
  }

  if (run.costSpentCents + TIER_FLOOR_CENTS[def.costTier] > run.costCapCents) {
    return {
      pass: false,
      code: "BUDGET_EXCEEDED",
      reason: `remaining budget ${run.costCapCents - run.costSpentCents}c < tier floor ${TIER_FLOOR_CENTS[def.costTier]}c for ${def.costTier}`,
    };
  }

  return { pass: true };
}
