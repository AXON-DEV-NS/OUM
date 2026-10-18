import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { StageKey } from "@/src/pipeline/stage";
import { createPipelineEngine } from "@/src/pipeline/runtime";

/**
 * Human decisions on a parked run (the only way qa/budget/gate/judge holds
 * move — by design, a machine never "decides").
 * POST /api/pipeline/runs/[id]/decision
 *
 *   approve → pass the waiting stage (S0/S9 approvals, S8 override is marked _forced)
 *   reject  → FAIL the run; the reason is tagged for the learning loop
 *   resume  → clear a hold and let the engine continue
 *   retry   → re-run the waiting stage (optionally rewinding to `toStage`)
 */

const DecisionSchema = z.strictObject({
  decision: z.enum(["approve", "reject", "resume", "retry"]),
  reason: z.string().min(2).max(2000).optional(),
  toStage: z.string().regex(/^S\d{1,2}$/).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = DecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "قرار غير صالح", issues: parsed.error.issues.slice(0, 6) },
      { status: 400 },
    );
  }

  const owned = await prisma.run.findFirst({ where: { id, userId: session.userId }, select: { id: true } });
  if (!owned) return NextResponse.json({ error: "Run not found." }, { status: 404 });

  if (parsed.data.decision === "reject" && !parsed.data.reason) {
    return NextResponse.json({ error: "الرفض يحتاج سبباً مكتوباً (يتعلم منه النظام)." }, { status: 400 });
  }

  try {
    const engine = createPipelineEngine();
    const outcome = await engine.decide(id, parsed.data.decision, {
      actorId: session.userId,
      reason: parsed.data.reason,
      toStage: parsed.data.toStage as StageKey | undefined,
    });
    const run = await prisma.run.findUnique({ where: { id } });
    return NextResponse.json({ outcome, run });
  } catch (error) {
    console.error("[pipeline/decision] run failed:", id, error);
    return NextResponse.json({ error: "تعذر تنفيذ القرار — حاول مجدداً." }, { status: 500 });
  }
}
