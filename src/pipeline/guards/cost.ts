/**
 * Cost guard: every paid provider call goes through `record`, which appends an
 * immutable cost_ledger row and refreshes the run total from the ledger sum
 * (idempotent — the ledger is the source of truth, not a mutable counter).
 */
import { estimateChatCents, CONFIG } from "../config";
import type { LedgerInput, PipelineStore, RunRecord } from "../store";

export interface SpendVerdict {
  ok: boolean;
  spent: number;
  cap: number;
  reason?: string;
}

export class CostGuard {
  constructor(private store: PipelineStore) {}

  async canSpend(run: RunRecord, estimateCents: number): Promise<SpendVerdict> {
    const spent = await this.store.ledgerTotal(run.id);
    const cap = run.costCapCents;
    if (spent + estimateCents > cap) {
      return { ok: false, spent, cap, reason: `budget cap reached: spent ${spent}c + estimate ${estimateCents}c > cap ${cap}c` };
    }
    return { ok: true, spent, cap };
  }

  /** append to the ledger and refresh run.costSpentCents from the ledger sum */
  async record(entry: LedgerInput): Promise<void> {
    await this.store.appendLedger(entry);
    const total = await this.store.ledgerTotal(entry.runId);
    await this.store.updateRun(entry.runId, { costSpentCents: total });
  }
}

export function estimateImageCents(n: number): number {
  return n * CONFIG.mediaEstimates.imageCents;
}

export function estimateTtsCents(chars: number): number {
  return Math.ceil((chars / 1000) * CONFIG.mediaEstimates.ttsPer1kCharsCents);
}

export function estimateRenderCents(minutes: number): number {
  return Math.ceil(minutes * CONFIG.mediaEstimates.renderPerMinuteCents);
}

export { estimateChatCents };
