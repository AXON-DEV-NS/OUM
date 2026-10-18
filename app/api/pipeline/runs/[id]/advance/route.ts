import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createPipelineEngine } from "@/src/pipeline/runtime";

/**
 * Advance a run by at most MAX_STEPS engine transitions.
 * POST /api/pipeline/runs/[id]/advance
 *
 * The engine is safe to call repeatedly: every step is guarded (tier order,
 * budget floors, judge availability) and holds park instead of failing.
 */
const MAX_STEPS = 25;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owned = await prisma.run.findFirst({ where: { id, userId: session.userId }, select: { id: true } });
  if (!owned) return NextResponse.json({ error: "Run not found." }, { status: 404 });

  try {
    const engine = createPipelineEngine();
    const result = await engine.run(id, MAX_STEPS);
    const run = await prisma.run.findUnique({ where: { id } });
    return NextResponse.json({ outcome: result.last, steps: result.steps, run });
  } catch (error) {
    console.error("[pipeline/advance] run failed:", id, error);
    return NextResponse.json({ error: "تعذر تقديم الرحلة — حاول مجدداً." }, { status: 500 });
  }
}
