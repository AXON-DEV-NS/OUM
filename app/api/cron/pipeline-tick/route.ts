import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { CONFIG } from "@/src/pipeline/config";
import { createPipelineEngine } from "@/src/pipeline/runtime";

/**
 * Pipeline heartbeat — the catch-up tick, called by Vercel Cron (see
 * vercel.json) or by any external pinger with the CRON_SECRET bearer token.
 *
 * It (1) repairs stale RUNNING stages, (2) wakes held/queued runs whose
 * blocker is machine-clearable (timing due, provider keys back, QUEUED), and
 * (3) prunes stale notifications. It NEVER resumes human holds (qa / budget /
 * gate / judge) — those only move through a decision by the owner.
 *
 * Vercel Hobby allows one invocation per day; the engine is built for
 * catch-up, so nothing is lost between ticks (YouTube publishes scheduled
 * uploads on time even when the run is parked).
 */

function isAuthorized(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** read notifications kept per user (older read ones are trimmed) */
const READ_KEEP = 200;

async function pruneNotifications(): Promise<{ deletedOld: number; trimmedRead: number } | { error: string }> {
  if (!process.env.DATABASE_URL) return { deletedOld: 0, trimmedRead: 0 };
  try {
    const cutoff = new Date(Date.now() - CONFIG.retention.notificationDays * 86_400_000);
    const old = await prisma.notification.deleteMany({ where: { createdAt: { lt: cutoff } } });

    let trimmedRead = 0;
    const users = await prisma.notification.groupBy({
      by: ["userId"],
      where: { readAt: { not: null }, userId: { not: null } },
      _count: { _all: true },
    });
    for (const u of users) {
      if (!u.userId || u._count._all <= READ_KEEP) continue;
      const keep = await prisma.notification.findMany({
        where: { userId: u.userId, readAt: { not: null } },
        orderBy: { createdAt: "desc" },
        take: READ_KEEP,
        select: { id: true },
      });
      const res = await prisma.notification.deleteMany({
        where: { userId: u.userId, readAt: { not: null }, id: { notIn: keep.map((k) => k.id) } },
      });
      trimmedRead += res.count;
    }
    return { deletedOld: old.count, trimmedRead };
  } catch (error) {
    console.warn("[cron/pipeline-tick] notification pruning failed:", error);
    return { error: "pruning failed" };
  }
}

async function handle(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const startedAt = new Date().toISOString();

  try {
    const engine = createPipelineEngine();
    const summary = await engine.tick();
    const retention = await pruneNotifications();

    console.log("[cron/pipeline-tick] ticked:", startedAt, JSON.stringify(summary));
    return NextResponse.json({ ok: true, startedAt, summary, retention });
  } catch (error) {
    console.error("[cron/pipeline-tick] failed:", startedAt, error);
    return NextResponse.json({ ok: false, error: "Pipeline tick failed." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
