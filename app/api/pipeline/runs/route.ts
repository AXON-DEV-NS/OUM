import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/services/audit";
import { CONFIG } from "@/src/pipeline/config";
import { createEngineDeps } from "@/src/pipeline/runtime";

/**
 * Pipeline runs of the signed-in user.
 *
 * GET  /api/pipeline/runs       → list recent runs (with channel titles)
 * POST /api/pipeline/runs       → queue a new run (S0..S12)
 *
 * The engine spends money only when it actually executes a stage, and every
 * stage is capped by the run budget. Creation itself is free and offline:
 * the run starts QUEUED and the next advance/tick moves it.
 */

const ACTIVE_STATUSES = ["QUEUED", "RUNNING", "HOLD", "WAITING_HUMAN"] as const;
const MAX_ACTIVE_RUNS = 3;

const CreateRunSchema = z.strictObject({
  channelId: z.string().min(1).max(40),
  path: z.enum(["AVATAR", "FACELESS", "MIXED"]),
  mode: z.enum(["COPILOT", "AUTOPILOT"]).optional(),
  costCapCents: z.number().int().min(1).max(100_000).optional(),
  locale: z.string().min(2).max(10).optional(),
  nicheKey: z.string().min(1).max(60).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const runs = await prisma.run.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      channelId: true,
      nicheKey: true,
      path: true,
      mode: true,
      status: true,
      currentStage: true,
      costCapCents: true,
      costSpentCents: true,
      locale: true,
      scheduledFor: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
      channel: { select: { title: true } },
    },
  });

  return NextResponse.json({ runs });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = CreateRunSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "طلب غير صالح", issues: parsed.error.issues.slice(0, 6) },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const cap = input.costCapCents ?? CONFIG.cost.defaultCapCents;
  if (cap < CONFIG.cost.minimumCapCents) {
    return NextResponse.json(
      { error: `الحد الأدنى للميزانية ${CONFIG.cost.minimumCapCents} سنتاً للرحلة الواحدة.` },
      { status: 400 },
    );
  }

  const channel = await prisma.channel.findFirst({
    where: { id: input.channelId, userId: session.userId },
    select: { id: true, niche: true, requiresAvatar: true, avatarImageMime: true },
  });
  if (!channel) {
    return NextResponse.json({ error: "Channel not found." }, { status: 404 });
  }

  const activeCount = await prisma.run.count({
    where: { userId: session.userId, status: { in: [...ACTIVE_STATUSES] } },
  });
  if (activeCount >= MAX_ACTIVE_RUNS) {
    return NextResponse.json(
      { error: `لديك ${MAX_ACTIVE_RUNS} رحلات نشطة بالفعل — أكملها أو أوقفها قبل بدء رحلة جديدة.` },
      { status: 409 },
    );
  }

  const warnings: string[] = [];
  const needsAvatar = input.path === "AVATAR" || input.path === "MIXED" || channel.requiresAvatar === true;
  if (needsAvatar && !channel.avatarImageMime) {
    warnings.push("مسار الأفاتار بلا صورة أفاتار مرفوعة — ستتوقف المرحلة S0 حتى ترفع صورة واضحة.");
  }

  const store = createEngineDeps().store;
  const run = await store.createRun({
    userId: session.userId,
    channelId: channel.id,
    path: input.path,
    mode: input.mode ?? "COPILOT",
    costCapCents: cap,
    locale: input.locale ?? "ar",
    nicheKey: input.nicheKey ?? channel.niche ?? null,
  });

  await writeAuditLog({
    action: "pipeline.run_created",
    actorId: session.userId,
    targetUserId: session.userId,
    metadata: { runId: run.id, channelId: channel.id, path: input.path, costCapCents: cap },
    ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
  });

  return NextResponse.json({ run, warnings }, { status: 201 });
}
