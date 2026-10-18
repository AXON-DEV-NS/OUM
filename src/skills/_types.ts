/**
 * Skill framework contracts.
 *
 * Every skill in the constitution is ONE file here under src/skills/<stage>/,
 * with a pinned version, a closed input schema, a closed output schema, a
 * human-readable deterministic checklist and golden examples.
 *
 * Conditional loading (constitution requirement): a skill declares its path
 * ("any" | "avatar" | "faceless"); the loader NEVER loads avatar skills for
 * faceless runs. Nothing else arbitrates this — it is code.
 */
import { z } from "zod";
import type { StageKey } from "@/src/pipeline/stage";
import type { LedgerInput, PipelineStore, QaInput, RunRecord } from "@/src/pipeline/store";
import type { LlmGateway, MediaGateway } from "@/src/pipeline/providers/types";
import { validationFailed } from "@/src/pipeline/errors";

export type SkillKind = "code" | "llm";
export type SkillPath = "any" | "avatar" | "faceless";

export interface SkillRuntime {
  run: RunRecord;
  stageKey: StageKey;
  stageRowId: string;
  llm: LlmGateway;
  media: MediaGateway;
  store: PipelineStore;
  now(): Date;
  log(msg: string): void;
  /** record a paid operation in the cost ledger (+ refresh run total) */
  spend(entry: Omit<LedgerInput, "runId" | "stageKey"> & { stageKey?: StageKey }): Promise<void>;
  /** record a QA row bound to this run+stage */
  recordQa(qa: Omit<QaInput, "runId" | "stageKey" | "stageRowId">): Promise<void>;
}

export interface SkillExample {
  name: string;
  input: unknown;
  /** shallow key expectations asserted by the golden tests */
  expectOutput?: Record<string, unknown>;
}

export interface SkillDefinition<I extends z.ZodType = z.ZodType, O extends z.ZodType = z.ZodType> {
  key: string;
  /** semantic version, pinned in run_stages.skillVersions */
  version: string;
  goal: string;
  kind: SkillKind;
  path: SkillPath;
  stages: StageKey[];
  /** must run on a family different from the writer's (judge) */
  judge?: boolean;
  input: I;
  output: O;
  /** deterministic checklist enforced by code + validators */
  checklist: string[];
  examples: SkillExample[];
  implemented: boolean;
  /** wave-2 justification when implemented=false */
  reason?: string;
  run?: (rt: SkillRuntime, input: z.infer<I>) => Promise<z.infer<O>>;
}

export function defineSkill<I extends z.ZodType, O extends z.ZodType>(def: SkillDefinition<I, O>): SkillDefinition<I, O> {
  return def;
}

/**
 * Execute a skill: parse input -> run -> parse output. Both directions are
 * closed contracts; a violation is a ValidationFailed (retryable, bounded).
 */
export async function executeSkill(def: SkillDefinition, rt: SkillRuntime, rawInput: unknown): Promise<unknown> {
  if (!def.implemented || !def.run) {
    throw validationFailed(`skill ${def.key} is not implemented yet (${def.reason ?? "wave 2"})`);
  }
  const parsed = def.input.safeParse(rawInput);
  if (!parsed.success) {
    throw validationFailed(`skill ${def.key}: invalid input`, { issues: parsed.error.issues.slice(0, 6) });
  }
  const out = await def.run(rt, parsed.data);
  const checked = def.output.safeParse(out);
  if (!checked.success) {
    throw validationFailed(`skill ${def.key}: invalid output`, { issues: checked.error.issues.slice(0, 6) });
  }
  return checked.data;
}

/** non-throwing variant used by golden tests */
export async function tryExecuteSkill(def: SkillDefinition, rt: SkillRuntime, rawInput: unknown): Promise<{ ok: true; output: unknown } | { ok: false; error: Error }> {
  try {
    return { ok: true, output: await executeSkill(def, rt, rawInput) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}
