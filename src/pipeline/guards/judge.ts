/**
 * Judge independence guard — "القاضي غير الكاتب".
 *
 * Any judging skill must be executed by a DIFFERENT model family than the one
 * that wrote the artifact. When only one family is configured the judge stage
 * MUST NOT run with the writer's family: the engine parks the run (cheap
 * failure) and asks the operator for a second provider key.
 */
import type { ModelFamily } from "../config";
import { judgeUnavailable } from "../errors";

export function sameFamily(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

/** pick a judge family different from the writer; null when impossible */
export function pickJudgeFamily(available: ModelFamily[], writerFamily: string | null | undefined): ModelFamily | null {
  const candidates = available.filter((f) => !sameFamily(f, writerFamily));
  return candidates[0] ?? null;
}

/** assert a judge exists, else throw JUDGE_UNAVAILABLE (cheap, parks the run) */
export function assertJudgeAvailable(
  available: ModelFamily[],
  writerFamily: string | null | undefined,
  context: string,
): ModelFamily {
  const judge = pickJudgeFamily(available, writerFamily);
  if (!judge) {
    throw judgeUnavailable(
      `${context}: no independent judge family (writer=${writerFamily ?? "unknown"}, configured=[${available.join(", ") || "none"}]). Add a second provider key.`,
      { writerFamily, available },
    );
  }
  return judge;
}
