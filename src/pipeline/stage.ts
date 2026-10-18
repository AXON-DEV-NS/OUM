/**
 * Stage contract of the 13-stage engine (S0 setup → S12 learning).
 *
 * A stage is a small, deterministic shell around a set of skills:
 *   gate(ctx)      -> may we even start? (cheap, mostly code)
 *   execute(ctx)   -> run the skills, produce the artifact
 *   validate(ctx)  -> deterministic checks over the artifact (no LLM)
 *
 * The engine (engine.ts) owns tier/cost/judge guards, retries and state.
 */
import type { CheckOutcome } from "./checks";
import type { LedgerInput, PipelineStore, QaInput, RunRecord, DnaRecord, StageRecord, ChannelContext } from "./store";
import type { LlmGateway, MediaGateway, YoutubeGateway, NotifierFn, PageSnapshot } from "./providers/types";
import type { SkillDefinition, SkillRuntime } from "@/src/skills/_types";

export const STAGE_KEYS = ["S0", "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11", "S12"] as const;
export type StageKey = (typeof STAGE_KEYS)[number];

export const STAGE_INDEX: Record<StageKey, number> = Object.fromEntries(STAGE_KEYS.map((k, i) => [k, i])) as Record<StageKey, number>;

export const STAGE_TITLES: Record<StageKey, string> = {
  S0: "Setup / channel DNA",
  S1: "Preflight health",
  S2: "Research & idea",
  S3: "Script",
  S4: "Storyboard & voice",
  S5: "Assets",
  S6: "Render & QA1",
  S7: "SEO pack",
  S8: "Final QA (QA2/QA3)",
  S9: "Human approval",
  S10: "Publish (private-first)",
  S11: "Post-publish checks",
  S12: "Learning",
};

/**
 * Cost tiers in increasing order. The engine refuses to enter a tier before
 * every cheaper stage passed (Fail Early: text < image < video).
 */
export type CostTier = "free" | "text" | "image" | "video" | "publish";

export interface GateResult {
  pass: boolean;
  code?: string;
  reason?: string;
}

export interface StageInputs {
  of(stageKey: StageKey): unknown;
  stage(stageKey: StageKey): StageRecord | null;
  all(): StageRecord[];
}

export interface StageContext {
  run: RunRecord;
  dna: DnaRecord | null;
  channel: ChannelContext | null;
  stageRow: StageRecord;
  store: PipelineStore;
  llm: LlmGateway;
  media: MediaGateway;
  youtube: YoutubeGateway;
  notify: NotifierFn;
  now(): Date;
  /** bounded public-page fetch (live in prod, stubbed in tests) */
  fetchPage(url: string): Promise<PageSnapshot>;
  inputs: StageInputs;
  /** skills loaded for this stage + run path (conditional loading applied) */
  skills: Record<string, SkillDefinition>;
  /** runtime handed to skill.run() — cost/qa/notify are wired to this stage */
  skill: SkillRuntime;
  log(msg: string): void;
  recordQa(qa: Omit<QaInput, "runId" | "stageKey" | "stageRowId">): Promise<void>;
  /** record a paid operation in this run's cost ledger (stageKey is bound) */
  spend(entry: Omit<LedgerInput, "runId" | "stageKey">): Promise<void>;
  /** true when the channel is avatar-based (MIXED loads avatar skills too) */
  usesAvatar(): boolean;
}

export interface StageHold {
  kind: "timing" | "budget" | "provider" | "judge" | "qa" | "gate";
  reason: string;
  /** timing holds: the instant the engine may auto-resume the stage */
  wakeAtIso?: string;
}

export interface StageResult<O = unknown> {
  output: O;
  score?: number;
  checkpoint?: Record<string, unknown>;
  /** park for a human decision (approval stages) */
  requiresHuman?: boolean;
  /** park without failing (timing waits, missing provider, qa hold) */
  hold?: StageHold;
  /** ask for an automatic retry with fix hints (maxAttempts respected) */
  retry?: { reason: string; fixes?: Array<{ text: string; stage?: string }> };
}

export interface StageDefinition<O = unknown> {
  key: StageKey;
  index: number;
  title: string;
  costTier: CostTier;
  maxAttempts: number;
  /** skill keys this stage uses (filtered by path at load time) */
  skills: string[];
  /** stage cannot start unless >= 2 model families are configured (judges) */
  needsJudge?: boolean;
  gate(ctx: StageContext): Promise<GateResult> | GateResult;
  execute(ctx: StageContext): Promise<StageResult<O>>;
  validate?(ctx: StageContext, result: StageResult<O>): Promise<CheckOutcome[]>;
}

export function defineStage<O>(def: StageDefinition<O>): StageDefinition<O> {
  return def;
}

/** execute a loaded skill by key, parsing input and output through zod */
export async function runStageSkill<T = unknown>(ctx: StageContext, skillKey: string, input: unknown): Promise<T> {
  const { executeSkill } = await import("@/src/skills/_types");
  const def = ctx.skills[skillKey];
  if (!def) throw new Error(`skill not loaded for stage ${ctx.stageRow.stageKey}: ${skillKey}`);
  return executeSkill(def, ctx.skill, input) as Promise<T>;
}
