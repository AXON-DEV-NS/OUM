/**
 * Shared helpers for skill implementations: schema-aware prompts, cost-aware
 * LLM calls, judge resolution (writer != judge) and stable hashing.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import { assertJudgeAvailable } from "@/src/pipeline/guards/judge";
import type { ModelFamily } from "@/src/pipeline/config";
import type { ChatJsonResult } from "@/src/pipeline/providers/types";
import type { SkillRuntime } from "./_types";

/** role text + the exact JSON Schema the model must return */
export function rolePrompt(role: string, schema: z.ZodType): string {
  let hint = "";
  try {
    hint = JSON.stringify(z.toJSONSchema(schema));
  } catch {
    hint = "";
  }
  return hint
    ? `${role}\n\nReturn ONLY a single JSON object matching this JSON Schema exactly (no markdown, no prose):\n${hint}`
    : role;
}

export interface LlmArgs {
  system: string;
  user: string;
  schema: z.ZodType;
  preferFamily?: ModelFamily;
  temperature?: number;
  maxOutTokens?: number;
}

/** LLM call + automatic cost ledger entry; returns data + provider metadata */
export async function llmJsonFull<T = unknown>(rt: SkillRuntime, key: string, args: LlmArgs): Promise<ChatJsonResult<T>> {
  const res = await rt.llm.chatJson<T>({ purpose: key, ...args });
  await rt.spend({
    provider: res.family,
    operation: `chat:${res.model}`,
    costCents: res.costCents,
    units: { in: res.inTokens, out: res.outTokens },
  });
  return res;
}

export async function llmJson<T = unknown>(rt: SkillRuntime, key: string, args: LlmArgs): Promise<T> {
  return (await llmJsonFull<T>(rt, key, args)).data;
}

export interface JudgeCall<T> {
  data: T;
  judgeFamily: ModelFamily;
  judgeModel: string;
}

/**
 * Resolve an independent judge family (never the writer's) and run the call.
 * Throws JUDGE_UNAVAILABLE (cheap, parks the run) when impossible.
 */
export async function runJudge<T = unknown>(
  rt: SkillRuntime,
  key: string,
  writerFamily: string | null | undefined,
  args: Omit<LlmArgs, "preferFamily">,
): Promise<JudgeCall<T>> {
  const families = await rt.llm.families();
  const judge = assertJudgeAvailable(families, writerFamily, `skill ${key}`);
  const res = await llmJsonFull<T>(rt, key, { ...args, preferFamily: judge });
  return { data: res.data, judgeFamily: res.family, judgeModel: res.model };
}

/** stable content hash for niche_kb dedupe */
export function contentHash(text: string): string {
  return createHash("sha1").update(text.trim().toLowerCase()).digest("hex").slice(0, 16);
}

export function clampText(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

export function jsonPayload(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
