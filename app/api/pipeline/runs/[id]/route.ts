import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

/**
 * One run in full: stages, QA evidence, ledger and notifications.
 * GET /api/pipeline/runs/[id]
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const run = await prisma.run.findFirst({
    where: { id, userId: session.userId },
    include: { channel: { select: { title: true, niche: true } } },
  });
  if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });

  const [stages, qa, notifications, ledger] = await Promise.all([
    prisma.runStage.findMany({ where: { runId: id }, orderBy: { index: "asc" } }),
    prisma.qaReport.findMany({ where: { runId: id }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.notification.findMany({ where: { runId: id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.costLedger.findMany({ where: { runId: id }, orderBy: { createdAt: "asc" } }),
  ]);

  return NextResponse.json({ run, stages, qa, notifications, ledger });
}
