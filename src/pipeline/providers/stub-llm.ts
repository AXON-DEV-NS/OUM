/**
 * Stub LLM gateway for tests and dry-runs: deterministic, offline, no keys.
 * It records every call and validates the response against the caller's zod
 * schema exactly like the live gateway does — so schemas are really tested.
 */
import { estimateChatCents, type ModelFamily } from "../config";
import type { ChatJsonArgs, ChatJsonResult, LlmGateway } from "./types";

export interface StubOptions {
  families?: ModelFamily[];
  /** return the raw JSON for a call (already-parsed object) */
  respond: (args: ChatJsonArgs) => unknown | Promise<unknown>;
  inTokens?: number;
  outTokens?: number;
}

export class StubLlm implements LlmGateway {
  readonly calls: ChatJsonArgs[] = [];
  constructor(private opts: StubOptions) {}

  async families(): Promise<ModelFamily[]> {
    return this.opts.families ?? ["deepseek", "openai"];
  }

  async has(f: ModelFamily): Promise<boolean> {
    return (await this.families()).includes(f);
  }

  async chatJson<T = unknown>(args: ChatJsonArgs): Promise<ChatJsonResult<T>> {
    this.calls.push(args);
    const fams = await this.families();
    const family: ModelFamily = args.preferFamily && fams.includes(args.preferFamily) ? args.preferFamily : fams[0];
    const raw = await this.opts.respond(args);
    const data = args.schema.parse(raw) as T;
    const inTokens = this.opts.inTokens ?? 800;
    const outTokens = this.opts.outTokens ?? 700;
    return {
      data,
      family,
      model: `stub-${family}`,
      inTokens,
      outTokens,
      costCents: estimateChatCents(family, `stub-${family}`, inTokens, outTokens) + 1,
    };
  }
}

/** calls recorded per purpose (skill key) */
export function callsByPurpose(llm: StubLlm): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of llm.calls) out[c.purpose] = (out[c.purpose] ?? 0) + 1;
  return out;
}
