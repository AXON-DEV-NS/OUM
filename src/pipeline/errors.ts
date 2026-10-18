/**
 * Error taxonomy of the pipeline engine.
 *
 * Two questions decide everything:
 *   retryable?  — can the same stage attempt again automatically?
 *   cheap?      — should the run STOP gracefully (HOLD) instead of burning
 *                 budget on an expensive tier? (Fail Early / Fail Cheap.)
 *
 * A "cheap" error NEVER retries and NEVER touches a paid tier: the engine
 * parks the stage as WAITING, holds the run and notifies the operator.
 */

export type PipelineErrorCode =
  | "GATE_BLOCKED"
  | "PROVIDER_MISSING"
  | "JUDGE_UNAVAILABLE"
  | "BUDGET_EXCEEDED"
  | "NOT_CONFIGURED"
  | "VALIDATION_FAILED"
  | "UPSTREAM_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "IDEMPOTENCY_CONFLICT"
  | "NOT_FOUND";

export interface PipelineErrorOptions {
  retryable?: boolean;
  cheap?: boolean;
  details?: unknown;
}

export class PipelineError extends Error {
  readonly code: PipelineErrorCode;
  readonly retryable: boolean;
  readonly cheap: boolean;
  readonly details?: unknown;

  constructor(code: PipelineErrorCode, message: string, opts: PipelineErrorOptions = {}) {
    super(message);
    this.name = "PipelineError";
    this.code = code;
    this.retryable = opts.retryable ?? false;
    this.cheap = opts.cheap ?? true;
    this.details = opts.details;
  }
}

/** Missing provider keys / not-configured capability. Parks the run. */
export const providerMissing = (what: string, details?: unknown) =>
  new PipelineError("PROVIDER_MISSING", `Provider not configured: ${what}`, { cheap: true, retryable: false, details });

/** A gate refused entry (previous stage failed, assets missing, ...). */
export const gateBlocked = (reason: string, details?: unknown) =>
  new PipelineError("GATE_BLOCKED", reason, { cheap: true, retryable: false, details });

/** No independent judge family is available (writer must differ from judge). */
export const judgeUnavailable = (reason: string, details?: unknown) =>
  new PipelineError("JUDGE_UNAVAILABLE", reason, { cheap: true, retryable: false, details });

/** The run cannot afford the next step under its cap. */
export const budgetExceeded = (spent: number, estimate: number, cap: number) =>
  new PipelineError("BUDGET_EXCEEDED", `Budget cap reached: spent=${spent}c estimate=${estimate}c cap=${cap}c`, {
    cheap: true,
    retryable: false,
    details: { spent, estimate, cap },
  });

/** Output failed a deterministic validator; retryable until attempts run out. */
export const validationFailed = (reason: string, details?: unknown) =>
  new PipelineError("VALIDATION_FAILED", reason, { cheap: false, retryable: true, details });

/** Network / provider 5xx; retryable until attempts run out. */
export const upstreamError = (reason: string, details?: unknown) =>
  new PipelineError("UPSTREAM_ERROR", reason, { cheap: false, retryable: true, details });

export const rateLimited = (reason: string, details?: unknown) =>
  new PipelineError("RATE_LIMITED", reason, { cheap: false, retryable: true, details });

export const timedOut = (reason: string, details?: unknown) =>
  new PipelineError("TIMEOUT", reason, { cheap: false, retryable: true, details });

export function isPipelineError(e: unknown): e is PipelineError {
  return e instanceof PipelineError;
}

/** Convert anything thrown into a PipelineError (unknown throws are retryable upstream errors). */
export function toPipelineError(e: unknown): PipelineError {
  if (isPipelineError(e)) return e;
  if (e instanceof Error) return upstreamError(e.message, { name: e.name });
  return upstreamError(String(e));
}
