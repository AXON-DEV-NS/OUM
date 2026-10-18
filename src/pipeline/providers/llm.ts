/**
 * Live LLM adapter: OpenAI-compatible chat-completions for the configured
 * families (DeepSeek and OpenAI share the wire format).
 *
 * Keys are resolved through the encrypted vault (lib/admin/secrets) with .env
 * fallback — the SAME source the admin settings page writes to, so adding a
 * key in the UI makes runs work without a redeploy.
 *
 * Rules enforced here:
 *   - no key            -> ProviderMissing (cheap fail, run parks)
 *   - 429               -> RateLimited (retryable)
 *   - 5xx / network     -> UpstreamError (retryable)
 *   - schema mismatch   -> ValidationFailed (retryable, bounded by attempts)
 *   - timeout           -> Timeout (retryable)
 */
import { getServiceKey } from "@/lib/admin/secrets";
import { CONFIG, estimateChatCents, type ModelFamily } from "../config";
import { providerMissing, rateLimited, timedOut, upstreamError, validationFailed } from "../errors";
import type { ChatJsonArgs, ChatJsonResult, LlmGateway } from "./types";

const SERVICE_KEY: Record<ModelFamily, string> = { deepseek: "DEEPSEEK_API_KEY", openai: "OPENAI_API_KEY" };
const BASE_URL: Record<ModelFamily, string> = { deepseek: "https://api.deepseek.com/v1", openai: "https://api.openai.com/v1" };

/** strip markdown fences and isolate the outermost JSON object */
export function parseJsonLoose(text: string): unknown {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  return JSON.parse(t) as unknown;
}

export class LiveLlm implements LlmGateway {
  private cachedFamilies: ModelFamily[] | null = null;
  private cachedAt = 0;

  async families(): Promise<ModelFamily[]> {
    if (this.cachedFamilies && Date.now() - this.cachedAt < 60_000) return this.cachedFamilies;
    const found: ModelFamily[] = [];
    for (const f of CONFIG.models.writerPreference) {
      const key = await getServiceKey(SERVICE_KEY[f]);
      if (key && key.trim().length > 0) found.push(f);
    }
    this.cachedFamilies = found;
    this.cachedAt = Date.now();
    return found;
  }

  async has(f: ModelFamily): Promise<boolean> {
    return (await this.families()).includes(f);
  }

  async chatJson<T = unknown>(args: ChatJsonArgs): Promise<ChatJsonResult<T>> {
    const fams = await this.families();
    if (fams.length === 0) throw providerMissing("no LLM family configured (add DEEPSEEK_API_KEY or OPENAI_API_KEY)");
    const family: ModelFamily = args.preferFamily && fams.includes(args.preferFamily) ? args.preferFamily : fams[0];
    const apiKey = await getServiceKey(SERVICE_KEY[family]);
    if (!apiKey) throw providerMissing(`${family} key missing`);
    const model = CONFIG.models.defaultModel[family];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONFIG.models.chatTimeoutMs);
    let res: Response;
    try {
      res = await fetch(`${BASE_URL[family]}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: args.system },
            { role: "user", content: args.user },
          ],
          temperature: args.temperature ?? CONFIG.models.temperatureDefault,
          max_tokens: args.maxOutTokens ?? CONFIG.models.maxOutTokensDefault,
          response_format: { type: "json_object" },
        }),
      });
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof Error && e.name === "AbortError") throw timedOut(`llm ${args.purpose} timed out after ${CONFIG.models.chatTimeoutMs}ms`);
      throw upstreamError(`llm ${args.purpose} network error: ${e instanceof Error ? e.message : String(e)}`);
    }
    clearTimeout(timer);

    if (res.status === 429) throw rateLimited(`llm ${args.purpose} rate limited`);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw upstreamError(`llm ${args.purpose} http ${res.status}: ${body.slice(0, 300)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    const inTokens = json.usage?.prompt_tokens ?? Math.ceil((args.system.length + args.user.length) / 4);
    const outTokens = json.usage?.completion_tokens ?? Math.ceil(content.length / 4);

    let parsed: unknown;
    try {
      parsed = parseJsonLoose(content);
    } catch {
      throw validationFailed(`llm ${args.purpose}: response is not valid JSON`, { preview: content.slice(0, 200) });
    }
    let data: unknown;
    try {
      data = args.schema.parse(parsed);
    } catch (e) {
      throw validationFailed(`llm ${args.purpose}: response violates its schema`, {
        issues: e instanceof Error ? e.message.slice(0, 400) : String(e),
      });
    }

    return { data: data as T, family, model, inTokens, outTokens, costCents: estimateChatCents(family, model, inTokens, outTokens) };
  }
}
