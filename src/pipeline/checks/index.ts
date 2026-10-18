/**
 * Deterministic check framework.
 *
 * Every automated gate of the pipeline is a list of these checks.
 * They are pure code (no language model), each returns a CheckOutcome, and
 * `runChecks` aggregates a weighted score of 0-100.
 *
 *   severity "fail" + pass:false  -> blocks the stage
 *   severity "warn" + pass:false  -> informs, never blocks
 *   severity "info" + skipped     -> prerequisite missing (e.g. no ffprobe);
 *                                    excluded from the score, never blocks
 */
import type { StageKey } from "@/src/pipeline/stage";

export type CheckSeverity = "info" | "warn" | "fail";

export interface CheckOutcome {
  key: string;
  pass: boolean;
  severity: CheckSeverity;
  message?: string;
  /** human-readable fix suggestion (feeds auto-fix / operator notifications) */
  fix?: string;
  /** when a fix belongs to an earlier stage, rewind to it */
  fixStage?: StageKey | string;
  /** relative weight inside the aggregate score (default 1) */
  weight?: number;
  /** true when the check could not run (excluded from score, never blocks) */
  skipped?: boolean;
}

export interface DeterministicCheck<T = unknown> {
  key: string;
  severity?: CheckSeverity;
  weight?: number;
  run(input: T): CheckOutcome | Promise<CheckOutcome>;
}

export function ok(key: string, message?: string, extra: Partial<CheckOutcome> = {}): CheckOutcome {
  return { key, pass: true, severity: "info", message, ...extra };
}

export function fail(key: string, message: string, extra: Partial<CheckOutcome> = {}): CheckOutcome {
  return { key, pass: false, severity: "fail", message, ...extra };
}

export function warn(key: string, message: string, extra: Partial<CheckOutcome> = {}): CheckOutcome {
  return { key, pass: false, severity: "warn", message, ...extra };
}

export function skip(key: string, reason: string): CheckOutcome {
  return { key, pass: true, severity: "info", message: reason, skipped: true };
}

export interface CheckRunSummary {
  outcomes: CheckOutcome[];
  /** no fail-severity outcome is false */
  pass: boolean;
  failed: CheckOutcome[];
  warnings: CheckOutcome[];
  /** weighted percent 0-100 over executed (non-skipped) checks */
  score: number;
}

/**
 * Run a homogeneous list of checks against one shared input.
 * A heterogeneous overload below covers stage validators where each check
 * receives its own slice of the artifact (script vs hooks vs archive...).
 */
export async function runChecks<T>(checks: DeterministicCheck<T>[], input: T): Promise<CheckRunSummary>;
export async function runChecks(checks: DeterministicCheck<never>[], input: unknown): Promise<CheckRunSummary>;
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function runChecks(checks: DeterministicCheck<any>[], input: any): Promise<CheckRunSummary> {
  const outcomes: CheckOutcome[] = [];
  for (const check of checks) {
    try {
      const out = await check.run(input);
      outcomes.push({ weight: check.weight ?? 1, ...out, key: out.key || check.key });
    } catch (e) {
      outcomes.push(fail(check.key, `check crashed: ${e instanceof Error ? e.message : String(e)}`));
    }
  }
  const executed = outcomes.filter((o) => !o.skipped);
  const totalWeight = executed.reduce((s, o) => s + (o.weight ?? 1), 0);
  const passedWeight = executed.reduce((s, o) => (o.severity !== "fail" || o.pass ? s + (o.weight ?? 1) : s), 0);
  const score = totalWeight === 0 ? 100 : Math.round((passedWeight / totalWeight) * 100);
  const failed = outcomes.filter((o) => o.severity === "fail" && !o.pass);
  const warnings = outcomes.filter((o) => o.severity === "warn" && !o.pass);
  return { outcomes, pass: failed.length === 0, failed, warnings, score };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Merge several check summaries into a weighted global score. */
export function mergeSummaries(groups: Array<{ summary: CheckRunSummary; weight: number }>): {
  score: number;
  outcomes: CheckOutcome[];
  failed: CheckOutcome[];
} {
  const totalW = groups.reduce((s, g) => s + g.weight, 0);
  const score = totalW === 0 ? 100 : Math.round(groups.reduce((s, g) => s + g.summary.score * g.weight, 0) / totalW);
  return {
    score,
    outcomes: groups.flatMap((g) => g.summary.outcomes),
    failed: groups.flatMap((g) => g.summary.failed),
  };
}
