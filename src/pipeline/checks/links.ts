/**
 * URL safety and bounded fetching.
 *
 * Static validation blocks SSRF-shaped URLs (private hosts, credentials,
 * non-https) before ANY network call. `fetchWithLimits` then fetches with a
 * hard timeout, a byte cap, a redirect cap and re-validates every hop.
 *
 * Residual risk (documented): DNS rebinding is not defended against — a
 * hostname resolving to a private IP at fetch time would pass static checks.
 * Acceptable for wave 1 (targets are public YouTube pages); flagged in audit.
 */
import { CONFIG } from "@/src/pipeline/config";
import { fail, ok, type CheckOutcome, type DeterministicCheck } from "./index";

const PRIVATE_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /^\[?::1\]?$/,
  /^0\.0\.0\.0$/,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /metadata\.google\.internal/i,
];

export function isPrivateHost(hostname: string): boolean {
  return PRIVATE_HOST_PATTERNS.some((p) => p.test(hostname));
}

export interface UrlValidation {
  ok: boolean;
  reason?: string;
  url?: URL;
}

export function validatePublicHttpsUrl(raw: string): UrlValidation {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "not a valid URL" };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "only https URLs are allowed" };
  if (url.username || url.password) return { ok: false, reason: "URLs with credentials are not allowed" };
  if (isPrivateHost(url.hostname)) return { ok: false, reason: "private/internal hosts are not allowed" };
  if (raw.length > 2048) return { ok: false, reason: "URL longer than 2048 chars" };
  return { ok: true, url };
}

export const checkUrlSafety: DeterministicCheck<{ url: string }> = {
  key: "links.safety",
  run({ url }): CheckOutcome {
    const v = validatePublicHttpsUrl(url);
    if (!v.ok) return fail("links.safety", `unsafe URL (${v.reason}): ${url.slice(0, 80)}`);
    return ok("links.safety");
  },
};

export interface FetchResult {
  ok: boolean;
  status: number;
  contentType: string | null;
  bytes: number;
  finalUrl: string;
  bodySnippet?: string;
  reason?: string;
}

/**
 * Bounded fetch: timeout, byte cap, redirect cap; every redirect hop is
 * re-validated with the same SSRF rules. Never throws — returns ok:false.
 */
export async function fetchWithLimits(
  raw: string,
  opts: { timeoutMs?: number; maxBytes?: number; maxRedirects?: number; wantBody?: boolean } = {},
): Promise<FetchResult> {
  const timeoutMs = opts.timeoutMs ?? CONFIG.network.timeoutMs;
  const maxBytes = opts.maxBytes ?? CONFIG.network.maxBytes;
  const maxRedirects = opts.maxRedirects ?? CONFIG.network.maxRedirects;

  let current = raw;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const v = validatePublicHttpsUrl(current);
    if (!v.ok) return { ok: false, status: 0, contentType: null, bytes: 0, finalUrl: current, reason: v.reason };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": "OUM-Pipeline/1.0 (+https://oum.local)" },
      });
      clearTimeout(timer);

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return { ok: false, status: res.status, contentType: null, bytes: 0, finalUrl: current, reason: "redirect without location" };
        current = new URL(loc, current).toString();
        continue;
      }

      const contentType = res.headers.get("content-type");
      let bytes = 0;
      let bodySnippet: string | undefined;
      if (res.body && opts.wantBody) {
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > maxBytes) {
            await reader.cancel();
            break;
          }
          chunks.push(value);
        }
        bodySnippet = new TextDecoder().decode(concat(chunks)).slice(0, 2000);
      } else if (res.body) {
        // count without buffering everything
        const reader = res.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > maxBytes) {
            await reader.cancel();
            break;
          }
        }
      }
      return { ok: res.status >= 200 && res.status < 400, status: res.status, contentType, bytes, finalUrl: current, bodySnippet };
    } catch (e) {
      clearTimeout(timer);
      const reason = e instanceof Error && e.name === "AbortError" ? `timeout after ${timeoutMs}ms` : e instanceof Error ? e.message : String(e);
      return { ok: false, status: 0, contentType: null, bytes: 0, finalUrl: current, reason };
    }
  }
  return { ok: false, status: 0, contentType: null, bytes: 0, finalUrl: current, reason: "too many redirects" };
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((s, c) => s + c.byteLength, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}
