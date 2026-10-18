import type { NextRequest } from "next/server";

/**
 * Same-origin guard for state-changing operator calls, on top of the
 * SameSite=Strict admin cookie. An attacker page cannot forge Origin.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin requests may omit Origin
  const host = request.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
