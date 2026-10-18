/**
 * Idempotency helpers: deterministic step keys + unique-violation detection.
 * Media/publish steps are the expensive ones — their keys are stored in the
 * stage checkpoint before the side effect and checked on every resume.
 */

export function stepKey(runId: string, stageKey: string, step: string, extra?: string | number): string {
  return [runId, stageKey, step, extra === undefined ? undefined : String(extra)].filter((p) => p !== undefined && p !== "").join(":");
}

/** Prisma unique-constraint violation (P2002) without importing the client */
export function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

export function checkpointDone(checkpoint: Record<string, unknown> | null | undefined, key: string): boolean {
  const done = checkpoint?.done;
  return Array.isArray(done) && done.includes(key);
}

export function markDone(current: Record<string, unknown>, key: string): Record<string, unknown> {
  const done = Array.isArray(current.done) ? (current.done as unknown[]) : [];
  if (done.includes(key)) return current;
  return { ...current, done: [...done, key] };
}
