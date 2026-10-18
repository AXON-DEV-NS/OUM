/**
 * Prisma-backed PipelineStore (production). Thin adapter: every method maps
 * one-to-one onto the schema added by migration 20261017184448_pipeline_core.
 * JSON columns are treated as opaque `unknown`; zod schemas validate them at
 * the skill/stage boundary.
 */
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type {
  AssetInput,
  AssetRecord,
  AuditInput,
  ChannelContext,
  CreateRunInput,
  DnaRecord,
  DnaUpsert,
  LedgerInput,
  LessonRecord,
  LessonUpsert,
  NotificationInput,
  NotificationRecord,
  PipelineStore,
  QaInput,
  QaRecord,
  RunListFilter,
  RunPatch,
  RunRecord,
  StagePatch,
  StageRecord,
  StageStatus,
} from "./store";

type Json = Record<string, unknown>;

/** JSON columns are opaque to the domain layer; Prisma only needs a serializable value. */
const asJson = (v: unknown): Prisma.InputJsonValue => {
  if (v === null || v === undefined) return {};
  if (Array.isArray(v)) return v as Prisma.InputJsonValue;
  if (typeof v === "object") return v as Prisma.InputJsonValue;
  return { value: v } as Prisma.InputJsonValue;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const mapRun = (r: any): RunRecord => ({
  id: r.id,
  userId: r.userId,
  channelId: r.channelId,
  nicheKey: r.nicheKey ?? null,
  path: r.path,
  mode: r.mode,
  status: r.status,
  currentStage: r.currentStage,
  costCapCents: r.costCapCents,
  costSpentCents: r.costSpentCents,
  locale: r.locale,
  scheduledFor: r.scheduledFor ?? null,
  lastError: r.lastError ?? null,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

const mapStage = (s: any): StageRecord => ({
  id: s.id,
  runId: s.runId,
  stageKey: s.stageKey,
  index: s.index,
  status: s.status,
  attempts: s.attempts,
  checkpoint: (s.checkpoint ?? {}) as Json,
  input: s.input ?? null,
  output: s.output ?? null,
  score: s.score ?? null,
  skillVersions: (s.skillVersions ?? null) as Record<string, string> | null,
  error: s.error ?? null,
  startedAt: s.startedAt ?? null,
  finishedAt: s.finishedAt ?? null,
  durationMs: s.durationMs ?? null,
});

const mapDna = (d: any): DnaRecord => ({
  id: d.id,
  channelId: d.channelId,
  version: d.version,
  rules: d.rules,
  conflicts: d.conflicts ?? null,
  competitors: d.competitors ?? null,
  audience: d.audience ?? null,
  avatar: d.avatar ?? null,
  mode: d.mode,
  approvedAt: d.approvedAt ?? null,
  approvedBy: d.approvedBy ?? null,
});

const mapLesson = (l: any): LessonRecord => ({
  id: l.id,
  nicheKey: l.nicheKey,
  lesson: l.lesson,
  lessonHash: l.lessonHash,
  confidence: l.confidence,
  occurrences: l.occurrences,
  status: l.status,
  evidence: l.evidence ?? null,
});

export class PrismaStore implements PipelineStore {
  async createRun(input: CreateRunInput): Promise<RunRecord> {
    const r = await prisma.run.create({
      data: {
        userId: input.userId,
        channelId: input.channelId,
        nicheKey: input.nicheKey ?? null,
        path: input.path,
        mode: input.mode ?? "COPILOT",
        status: input.status ?? "QUEUED",
        costCapCents: input.costCapCents,
        locale: input.locale ?? "en",
        scheduledFor: input.scheduledFor ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
      },
    });
    return mapRun(r);
  }

  async getRun(id: string): Promise<RunRecord | null> {
    const r = await prisma.run.findUnique({ where: { id } });
    return r ? mapRun(r) : null;
  }

  async updateRun(id: string, patch: RunPatch): Promise<RunRecord> {
    const data: Record<string, unknown> = {};
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.currentStage !== undefined) data.currentStage = patch.currentStage;
    if (patch.costSpentCents !== undefined) data.costSpentCents = patch.costSpentCents;
    if ("scheduledFor" in patch) data.scheduledFor = patch.scheduledFor ?? null;
    if ("lastError" in patch) data.lastError = patch.lastError ?? null;
    if ("nicheKey" in patch) data.nicheKey = patch.nicheKey ?? null;
    if (patch.mode !== undefined) data.mode = patch.mode;
    const r = await prisma.run.update({ where: { id }, data });
    return mapRun(r);
  }

  async listRuns(filter: RunListFilter): Promise<RunRecord[]> {
    const rows = await prisma.run.findMany({
      where: {
        ...(filter.statuses?.length ? { status: { in: filter.statuses } } : {}),
        ...(filter.scheduledBefore ? { scheduledFor: { not: null, lte: filter.scheduledBefore } } : {}),
        ...(filter.staleBefore ? { updatedAt: { lte: filter.staleBefore } } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: filter.limit ?? 100,
    });
    return rows.map(mapRun);
  }

  async countRuns(filter: { userId?: string; channelId?: string; statuses?: RunRecord["status"][] }): Promise<number> {
    return prisma.run.count({
      where: {
        ...(filter.userId ? { userId: filter.userId } : {}),
        ...(filter.channelId ? { channelId: filter.channelId } : {}),
        ...(filter.statuses?.length ? { status: { in: filter.statuses } } : {}),
      },
    });
  }

  async getDna(channelId: string): Promise<DnaRecord | null> {
    const d = await prisma.channelDna.findUnique({ where: { channelId } });
    return d ? mapDna(d) : null;
  }

  async upsertDna(channelId: string, data: DnaUpsert): Promise<DnaRecord> {
    const existing = await prisma.channelDna.findUnique({ where: { channelId } });
    const d = existing
      ? await prisma.channelDna.update({
          where: { channelId },
          data: {
            version: existing.version + 1,
            rules: asJson(data.rules),
            ...(data.conflicts !== undefined ? { conflicts: asJson(data.conflicts) } : {}),
            ...(data.competitors !== undefined ? { competitors: asJson(data.competitors) } : {}),
            ...(data.audience !== undefined ? { audience: asJson(data.audience) } : {}),
            ...(data.avatar !== undefined ? { avatar: asJson(data.avatar) } : {}),
            mode: asJson(data.mode),
          },
        })
      : await prisma.channelDna.create({
          data: {
            channelId,
            rules: asJson(data.rules),
            conflicts: asJson(data.conflicts ?? null),
            competitors: asJson(data.competitors ?? null),
            audience: asJson(data.audience ?? null),
            avatar: asJson(data.avatar ?? null),
            mode: asJson(data.mode),
          },
        });
    return mapDna(d);
  }

  async approveDna(channelId: string, actorId: string): Promise<void> {
    await prisma.channelDna.update({ where: { channelId }, data: { approvedAt: new Date(), approvedBy: actorId } });
  }

  async getChannelContext(channelId: string): Promise<ChannelContext | null> {
    const c = await prisma.channel.findUnique({ where: { id: channelId }, include: { user: true } });
    if (!c) return null;
    const buf = c.avatarImage ? new Uint8Array(c.avatarImage) : null;
    return {
      id: c.id,
      userId: c.userId,
      title: c.title,
      niche: c.niche ?? null,
      markets: c.markets,
      tone: c.tone ?? null,
      requiresAvatar: c.requiresAvatar ?? false,
      avatarImageBytes: c.avatarImage ? c.avatarImage.length : null,
      avatarImageBuffer: buf,
      avatarImageMime: c.avatarImageMime ?? null,
      referenceChannelUrl: c.referenceChannelUrl ?? null,
      referenceVideoUrl: c.referenceVideoUrl ?? null,
      hasAccessToken: !!c.accessToken,
      tokenExpired: c.tokenExpiresAt ? c.tokenExpiresAt.getTime() < Date.now() : true,
      customInstructions: c.user?.customInstructions ?? null,
    };
  }

  async listStages(runId: string): Promise<StageRecord[]> {
    const rows = await prisma.runStage.findMany({ where: { runId }, orderBy: { index: "asc" } });
    return rows.map(mapStage);
  }

  async getStage(runId: string, stageKey: string): Promise<StageRecord | null> {
    const s = await prisma.runStage.findUnique({ where: { runId_stageKey: { runId, stageKey } } });
    return s ? mapStage(s) : null;
  }

  async ensureStage(runId: string, stageKey: string, index: number): Promise<StageRecord> {
    try {
      const s = await prisma.runStage.upsert({
        where: { runId_stageKey: { runId, stageKey } },
        create: { runId, stageKey, index },
        update: {},
      });
      return mapStage(s);
    } catch (e) {
      // concurrent create race: read instead
      const s = await prisma.runStage.findUnique({ where: { runId_stageKey: { runId, stageKey } } });
      if (!s) throw e;
      return mapStage(s);
    }
  }

  async updateStage(runId: string, stageKey: string, patch: StagePatch): Promise<StageRecord> {
    const current = await prisma.runStage.findUnique({ where: { runId_stageKey: { runId, stageKey } } });
    const mergedCheckpoint: Prisma.InputJsonValue | undefined =
      patch.checkpoint !== undefined
        ? ({ ...(asJson(current?.checkpoint ?? null) as Record<string, unknown>), ...patch.checkpoint } as unknown as Prisma.InputJsonValue)
        : undefined;
    const s = await prisma.runStage.update({
      where: { runId_stageKey: { runId, stageKey } },
      data: {
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.attempts !== undefined ? { attempts: patch.attempts } : {}),
        ...(mergedCheckpoint !== undefined ? { checkpoint: mergedCheckpoint } : {}),
        ...(patch.input !== undefined ? { input: asJson(patch.input) } : {}),
        ...(patch.output !== undefined ? { output: asJson(patch.output) } : {}),
        ...(patch.score !== undefined ? { score: patch.score } : {}),
        ...(patch.skillVersions !== undefined ? { skillVersions: patch.skillVersions } : {}),
        ...("error" in patch ? { error: patch.error ?? null } : {}),
        ...("startedAt" in patch ? { startedAt: patch.startedAt ?? null } : {}),
        ...("finishedAt" in patch ? { finishedAt: patch.finishedAt ?? null } : {}),
        ...("durationMs" in patch ? { durationMs: patch.durationMs ?? null } : {}),
      },
    });
    return mapStage(s);
  }

  async lockStage(runId: string, stageKey: string, from: StageStatus[]): Promise<boolean> {
    const res = await prisma.runStage.updateMany({
      where: { runId, stageKey, status: { in: from } },
      data: { status: "RUNNING", attempts: { increment: 1 }, startedAt: new Date(), finishedAt: null, error: null },
    });
    return res.count > 0;
  }

  async resetStagesFrom(runId: string, fromIndex: number, note?: string): Promise<void> {
    if (note) {
      const rows = await prisma.runStage.findMany({ where: { runId, index: { gte: fromIndex } } });
      for (const row of rows) {
        await prisma.runStage.update({
          where: { id: row.id },
          data: { checkpoint: { ...(asJson(row.checkpoint) as Record<string, unknown>), edits: note } as unknown as Prisma.InputJsonValue },
        });
      }
    }
    await prisma.runStage.updateMany({
      where: { runId, index: { gte: fromIndex } },
      data: { status: "PENDING", attempts: 0, error: null, finishedAt: null, durationMs: null },
    });
  }

  async addAsset(a: AssetInput): Promise<AssetRecord> {
    const rec = await prisma.asset.create({
      data: {
        runId: a.runId,
        kind: a.kind,
        stage: a.stage ?? null,
        filePath: a.filePath ?? null,
        mimeType: a.mimeType ?? null,
        bytes: a.bytes ?? null,
        width: a.width ?? null,
        height: a.height ?? null,
        durationSec: a.durationSec ?? null,
        source: a.source,
        provider: a.provider ?? null,
        license: a.license ?? null,
        licenseUrl: a.licenseUrl ?? null,
        meta: asJson(a.meta ?? null),
      },
    });
    return { ...a, id: rec.id };
  }

  async listAssets(runId: string): Promise<AssetRecord[]> {
    const rows = await prisma.asset.findMany({ where: { runId }, orderBy: { createdAt: "asc" } });
    return rows.map((r) => ({
      id: r.id,
      runId: r.runId,
      kind: r.kind,
      stage: r.stage ?? null,
      filePath: r.filePath ?? null,
      mimeType: r.mimeType ?? null,
      bytes: r.bytes ?? null,
      width: r.width ?? null,
      height: r.height ?? null,
      durationSec: r.durationSec ?? null,
      source: r.source,
      provider: r.provider ?? null,
      license: r.license ?? null,
      licenseUrl: r.licenseUrl ?? null,
      meta: r.meta ?? null,
    }));
  }

  async appendLedger(e: LedgerInput): Promise<void> {
    await prisma.costLedger.create({
      data: {
        runId: e.runId,
        stageKey: e.stageKey,
        provider: e.provider,
        operation: e.operation,
        units: asJson(e.units ?? null),
        costCents: e.costCents,
        currency: e.currency ?? "usd",
        meta: asJson(e.meta ?? null),
      },
    });
  }

  async ledgerTotal(runId: string): Promise<number> {
    const agg = await prisma.costLedger.aggregate({ where: { runId }, _sum: { costCents: true } });
    return agg._sum.costCents ?? 0;
  }

  async addQa(q: QaInput): Promise<void> {
    await prisma.qaReport.create({
      data: {
        runId: q.runId,
        stageKey: q.stageKey,
        stageRowId: q.stageRowId ?? null,
        checkKey: q.checkKey,
        kind: q.kind,
        score: q.score ?? null,
        passed: q.passed,
        reasons: asJson(q.reasons ?? null),
        action: q.action ?? null,
        judgeModel: q.judgeModel ?? null,
        writerModel: q.writerModel ?? null,
      },
    });
  }

  async listQa(runId: string): Promise<QaRecord[]> {
    const rows = await prisma.qaReport.findMany({ where: { runId }, orderBy: { createdAt: "asc" } });
    return rows.map((r) => ({
      id: r.id,
      runId: r.runId,
      stageKey: r.stageKey,
      stageRowId: r.stageRowId ?? undefined,
      checkKey: r.checkKey,
      kind: r.kind as QaRecord["kind"],
      score: r.score ?? undefined,
      passed: r.passed,
      reasons: r.reasons ?? undefined,
      action: r.action ?? undefined,
      judgeModel: r.judgeModel ?? undefined,
      writerModel: r.writerModel ?? undefined,
      createdAt: r.createdAt,
    }));
  }

  async addNotification(n: NotificationInput): Promise<NotificationRecord> {
    const rec = await prisma.notification.create({
      data: {
        userId: n.userId ?? null,
        runId: n.runId ?? null,
        channel: n.channel,
        kind: n.kind,
        title: n.title,
        body: n.body,
        data: asJson(n.data ?? null),
      },
    });
    return {
      id: rec.id,
      userId: n.userId,
      runId: n.runId,
      channel: n.channel,
      kind: n.kind,
      title: n.title,
      body: n.body,
      data: n.data,
      sentAt: rec.sentAt ?? null,
      readAt: rec.readAt ?? null,
      createdAt: rec.createdAt,
    };
  }

  async addAudit(e: AuditInput): Promise<void> {
    await prisma.auditLog.create({
      data: {
        action: e.action,
        actorId: e.actorId,
        actorRole: e.actorRole ?? "client",
        targetUserId: e.targetUserId ?? null,
        metadata: asJson(e.metadata ?? null),
        ipAddress: e.ipAddress ?? null,
      },
    });
  }

  async upsertLesson(l: LessonUpsert): Promise<LessonRecord> {
    const existing = await prisma.nicheKb.findUnique({ where: { nicheKey_lessonHash: { nicheKey: l.nicheKey, lessonHash: l.lessonHash } } });
    if (existing) {
      const occurrences = existing.occurrences + 1;
      const rec = await prisma.nicheKb.update({
        where: { id: existing.id },
        data: {
          occurrences,
          confidence: Math.min(9, existing.confidence + 1),
          status: occurrences >= 2 ? "active" : "pending",
          ...(l.evidence !== undefined ? { evidence: asJson(l.evidence) } : {}),
        },
      });
      return mapLesson(rec);
    }
    const rec = await prisma.nicheKb.create({
      data: {
        nicheKey: l.nicheKey,
        lesson: l.lesson,
        lessonHash: l.lessonHash,
        evidence: asJson(l.evidence ?? null),
        source: l.source ?? null,
        channelId: l.channelId ?? null,
      },
    });
    return mapLesson(rec);
  }

  async listLessons(nicheKey: string, limit = 50): Promise<LessonRecord[]> {
    const rows = await prisma.nicheKb.findMany({ where: { nicheKey }, orderBy: { updatedAt: "desc" }, take: limit });
    return rows.map(mapLesson);
  }

  async getSetting(key: string): Promise<unknown | null> {
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    return row ? row.value : null;
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    await prisma.systemSetting.upsert({ where: { key }, create: { key, value: value as any }, update: { value: value as any } });
  }

  async listArchiveTitles(channelId: string, limit: number): Promise<string[]> {
    const rows = await prisma.contentItem.findMany({
      where: { channelId },
      select: { title: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map((r) => r.title);
  }

  async listScheduledTimes(channelId: string, since: Date): Promise<Date[]> {
    const rows = await prisma.run.findMany({
      where: { channelId, scheduledFor: { not: null, gte: since } },
      select: { scheduledFor: true },
    });
    return rows.map((r) => r.scheduledFor!).filter(Boolean);
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
