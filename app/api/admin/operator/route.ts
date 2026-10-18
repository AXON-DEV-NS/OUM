import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/admin-session";
import { checkRateLimit } from "@/lib/security/guardian";
import {
  HISTORY_LIMIT,
  MESSAGE_MAX_CHARS,
  OperatorError,
  operatorOnline,
  runOperatorTurn,
  type HistoryEntry,
} from "@/lib/admin/operator/agent";
import { isSameOrigin } from "@/lib/admin/operator/request";

/** Owner-only operator: status + one command turn. */
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    online: operatorOnline(),
    owner: session.email,
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
  });
}

const BodySchema = z.strictObject({
  message: z.string().min(1).max(MESSAGE_MAX_CHARS),
  history: z
    .array(
      z.strictObject({
        role: z.enum(["owner", "operator"]),
        content: z.string().max(MESSAGE_MAX_CHARS),
      }),
    )
    .max(HISTORY_LIMIT * 2)
    .optional(),
});

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });

  const limit = await checkRateLimit(`admin-operator:${session.email}`, 40, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many operator requests. Wait a minute." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  }

  try {
    const turn = await runOperatorTurn({
      message: parsed.data.message,
      history: parsed.data.history as HistoryEntry[] | undefined,
      actor: { id: session.userId || "admin-owner", email: session.email },
    });
    return NextResponse.json({ ok: true, ...turn });
  } catch (error) {
    if (error instanceof OperatorError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("[admin/operator]", error);
    return NextResponse.json({ error: "The operator failed to complete the request." }, { status: 500 });
  }
}
