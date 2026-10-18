import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/admin-session";
import { checkRateLimit } from "@/lib/security/guardian";
import { executePending, OperatorError } from "@/lib/admin/operator/agent";
import { isSameOrigin } from "@/lib/admin/operator/request";

const BodySchema = z.strictObject({ token: z.string().min(10).max(20_000) });

/** Executes a write action with the owner's signed confirmation token. */
export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });

  const limit = await checkRateLimit(`admin-operator-confirm:${session.email}`, 60, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many confirmations. Wait a minute." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid confirmation" }, { status: 400 });

  try {
    const executed = await executePending(parsed.data.token, {
      id: session.userId || "admin-owner",
      email: session.email,
    });
    return NextResponse.json({ ok: true, ...executed });
  } catch (error) {
    if (error instanceof OperatorError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[admin/operator/confirm]", error);
    return NextResponse.json({ error: "The confirmed action failed." }, { status: 500 });
  }
}
