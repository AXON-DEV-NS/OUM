/**
 * Signed, short-lived confirmation tokens for write actions.
 *
 * The model can only PROPOSE a write; the token is what the owner's browser
 * sends back after clicking Confirm. It is bound to:
 *   - the owner's admin email (sub),
 *   - the exact tool name and validated input,
 *   - a unique id (jti, replay-protected via the audit log),
 *   - a short expiry (5 minutes).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const PENDING_TTL_MS = 5 * 60 * 1000;

export const PendingPayloadSchema = z.strictObject({
  sub: z.string().min(3).max(320),
  jti: z.string().min(8).max(80),
  exp: z.number().int().positive(),
  tool: z.string().min(1).max(80),
  input: z.unknown(),
});

export type PendingPayload = z.infer<typeof PendingPayloadSchema>;

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function hmac(payloadB64: string, secret: Uint8Array): Buffer {
  return createHmac("sha256", secret).update(payloadB64).digest();
}

export function signPending(payload: PendingPayload, secret: Uint8Array): string {
  const parsed = PendingPayloadSchema.parse(payload);
  const body = b64url(Buffer.from(JSON.stringify(parsed), "utf8"));
  return `${body}.${b64url(hmac(body, secret))}`;
}

export interface PendingVerification {
  ok: boolean;
  payload?: PendingPayload;
  reason?: string;
}

export function verifyPending(
  token: unknown,
  secret: Uint8Array,
  now: number = Date.now(),
): PendingVerification {
  if (typeof token !== "string" || token.length < 10 || token.length > 20_000) {
    return { ok: false, reason: "malformed token" };
  }
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) return { ok: false, reason: "malformed token" };

  let expected: Buffer;
  let received: Buffer;
  try {
    expected = hmac(body, secret);
    received = Buffer.from(signature, "base64url");
  } catch {
    return { ok: false, reason: "malformed signature" };
  }
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return { ok: false, reason: "invalid signature" };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed payload" };
  }

  const parsed = PendingPayloadSchema.safeParse(decoded);
  if (!parsed.success) return { ok: false, reason: "invalid payload" };
  if (parsed.data.exp <= now) return { ok: false, reason: "confirmation expired" };
  if (parsed.data.exp > now + PENDING_TTL_MS + 60_000) return { ok: false, reason: "invalid expiry" };

  return { ok: true, payload: parsed.data };
}
