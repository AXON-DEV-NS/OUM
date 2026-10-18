/**
 * In-memory PipelineStore: the test double that makes the whole engine and
 * every stage runnable offline, deterministically, with zero providers.
 */
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

const clone = <T>(x: T): T => structuredClone(x);

export class MemoryStore implements PipelineStore {
  private runs = new Map<string, RunRecord>();
  private stages = new Map<string, StageRecord>();
  private dnas = new Map<string, DnaRecord>();
  private assets: AssetRecord[] = [];
  private ledgerRows: LedgerInput[] = [];
  private qaRows: QaRecord[] = [];
  private notifications: NotificationRecord[] = [];
  private audits: AuditInput[] = [];
  private lessons = new Map<string, LessonRecord>();
  private settings = new Map<string, unknown>();
  private archive = new Map<string, string[]>();
  private channels = new Map<string, ChannelContext>();
  private seq = 0;

  private id(prefix: string): string {
    return `${prefix}_${++this.seq}`;
  }

  private stageKeyOf(runId: string, stageKey: string): string {
    return `${runId}::${stageKey}`;
  }

  /** test helper: seed past published titles for dedup/originality checks */
  seedArchiveTitles(channelId: string, titles: string[]): void {
    this.archive.set(channelId, [...(this.archive.get(channelId) ?? []), ...titles]);
  }

  /** test helper: register a channel context */
  seedChannel(ctx: ChannelContext): void {
    this.channels.set(ctx.id, clone(ctx));
  }

  async createRun(input: CreateRunInput): Promise<RunRecord> {
    const now = new Date();
    const run: RunRecord = {
      id: this.id("run"),
      userId: input.userId,
      channelId: input.channelId,
      nicheKey: input.nicheKey ?? null,
      path: input.path,
      mode: input.mode ?? "COPILOT",
      status: input.status ?? "QUEUED",
      currentStage: 0,
      costCapCents: input.costCapCents,
      costSpentCents: 0,
      locale: input.locale ?? "en",
      scheduledFor: input.scheduledFor ?? null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    };
    this.runs.set(run.id, run);
    return clone(run);
  }

  async getRun(id: string): Promise<RunRecord | null> {
    const r = this.runs.get(id);
    return r ? clone(r) : null;
  }

  async updateRun(id: string, patch: RunPatch): Promise<RunRecord> {
    const r = this.runs.get(id);
    if (!r) throw new Error(`run not found: ${id}`);
    if (patch.status !== undefined) r.status = patch.status;
    if (patch.currentStage !== undefined) r.currentStage = patch.currentStage;
    if (patch.costSpentCents !== undefined) r.costSpentCents = patch.costSpentCents;
    if ("scheduledFor" in patch) r.scheduledFor = patch.scheduledFor ?? null;
    if ("lastError" in patch) r.lastError = patch.lastError ?? null;
    if ("nicheKey" in patch) r.nicheKey = patch.nicheKey ?? null;
    if (patch.mode !== undefined) r.mode = patch.mode;
    r.updatedAt = new Date();
    return clone(r);
  }

  async listRuns(filter: RunListFilter): Promise<RunRecord[]> {
    let out = [...this.runs.values()];
    if (filter.statuses?.length) out = out.filter((r) => filter.statuses!.includes(r.status));
    if (filter.scheduledBefore) out = out.filter((r) => r.scheduledFor !== null && r.scheduledFor <= filter.scheduledBefore!);
    if (filter.staleBefore) out = out.filter((r) => r.updatedAt <= filter.staleBefore!);
    out.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return clone(out.slice(0, filter.limit ?? 100));
  }

  async countRuns(filter: { userId?: string; channelId?: string; statuses?: RunRecord["status"][] }): Promise<number> {
    let out = [...this.runs.values()];
    if (filter.userId) out = out.filter((r) => r.userId === filter.userId);
    if (filter.channelId) out = out.filter((r) => r.channelId === filter.channelId);
    if (filter.statuses?.length) out = out.filter((r) => filter.statuses!.includes(r.status));
    return out.length;
  }

  async getDna(channelId: string): Promise<DnaRecord | null> {
    const d = this.dnas.get(channelId);
    return d ? clone(d) : null;
  }

  async upsertDna(channelId: string, data: DnaUpsert): Promise<DnaRecord> {
    const existing = this.dnas.get(channelId);
    const record: DnaRecord = {
      id: existing?.id ?? this.id("dna"),
      channelId,
      version: (existing?.version ?? 0) + 1,
      rules: data.rules,
      conflicts: data.conflicts ?? existing?.conflicts ?? null,
      competitors: data.competitors ?? existing?.competitors ?? null,
      audience: data.audience ?? existing?.audience ?? null,
      avatar: data.avatar ?? existing?.avatar ?? null,
      mode: data.mode,
      approvedAt: existing?.approvedAt ?? null,
      approvedBy: existing?.approvedBy ?? null,
    };
    this.dnas.set(channelId, record);
    return clone(record);
  }

  async approveDna(channelId: string, actorId: string): Promise<void> {
    const d = this.dnas.get(channelId);
    if (!d) throw new Error(`dna not found for channel ${channelId}`);
    d.approvedAt = new Date();
    d.approvedBy = actorId;
  }

  async getChannelContext(channelId: string): Promise<ChannelContext | null> {
    const c = this.channels.get(channelId);
    return c ? clone(c) : null;
  }

  async listStages(runId: string): Promise<StageRecord[]> {
    const out = [...this.stages.values()].filter((s) => s.runId === runId);
    out.sort((a, b) => a.index - b.index);
    return clone(out);
  }

  async getStage(runId: string, stageKey: string): Promise<StageRecord | null> {
    const s = this.stages.get(this.stageKeyOf(runId, stageKey));
    return s ? clone(s) : null;
  }

  async ensureStage(runId: string, stageKey: string, index: number): Promise<StageRecord> {
    const key = this.stageKeyOf(runId, stageKey);
    let s = this.stages.get(key);
    if (!s) {
      s = {
        id: this.id("stage"),
        runId,
        stageKey,
        index,
        status: "PENDING",
        attempts: 0,
        checkpoint: {},
        input: null,
        output: null,
        score: null,
        skillVersions: null,
        error: null,
        startedAt: null,
        finishedAt: null,
        durationMs: null,
      };
      this.stages.set(key, s);
    }
    return clone(s);
  }

  async updateStage(runId: string, stageKey: string, patch: StagePatch): Promise<StageRecord> {
    const key = this.stageKeyOf(runId, stageKey);
    const s = this.stages.get(key);
    if (!s) throw new Error(`stage not found: ${key}`);
    if (patch.status !== undefined) s.status = patch.status;
    if (patch.attempts !== undefined) s.attempts = patch.attempts;
    if (patch.checkpoint !== undefined) s.checkpoint = { ...s.checkpoint, ...clone(patch.checkpoint) };
    if (patch.input !== undefined) s.input = clone(patch.input);
    if (patch.output !== undefined) s.output = clone(patch.output);
    if (patch.score !== undefined) s.score = patch.score;
    if (patch.skillVersions !== undefined) s.skillVersions = clone(patch.skillVersions);
    if ("error" in patch) s.error = patch.error ?? null;
    if ("startedAt" in patch) s.startedAt = patch.startedAt ?? null;
    if ("finishedAt" in patch) s.finishedAt = patch.finishedAt ?? null;
    if ("durationMs" in patch) s.durationMs = patch.durationMs ?? null;
    return clone(s);
  }

  async lockStage(runId: string, stageKey: string, from: StageStatus[]): Promise<boolean> {
    const key = this.stageKeyOf(runId, stageKey);
    const s = this.stages.get(key);
    if (!s || !from.includes(s.status)) return false;
    s.status = "RUNNING";
    s.attempts += 1;
    s.startedAt = new Date();
    s.finishedAt = null;
    s.error = null;
    return true;
  }

  async resetStagesFrom(runId: string, fromIndex: number, note?: string): Promise<void> {
    for (const s of this.stages.values()) {
      if (s.runId !== runId || s.index < fromIndex) continue;
      s.status = "PENDING";
      s.attempts = 0;
      s.error = null;
      s.finishedAt = null;
      s.durationMs = null;
      if (note) s.checkpoint = { ...s.checkpoint, edits: note };
    }
  }

  async addAsset(a: AssetInput): Promise<AssetRecord> {
    const rec: AssetRecord = { id: this.id("asset"), ...clone(a) };
    this.assets.push(rec);
    return clone(rec);
  }

  async listAssets(runId: string): Promise<AssetRecord[]> {
    return clone(this.assets.filter((a) => a.runId === runId));
  }

  async appendLedger(e: LedgerInput): Promise<void> {
    this.ledgerRows.push(clone(e));
  }

  async ledgerTotal(runId: string): Promise<number> {
    return this.ledgerRows.filter((l) => l.runId === runId).reduce((s, l) => s + l.costCents, 0);
  }

  async addQa(q: QaInput): Promise<void> {
    this.qaRows.push({ id: this.id("qa"), createdAt: new Date(), ...clone(q) });
  }

  async listQa(runId: string): Promise<QaRecord[]> {
    return clone(this.qaRows.filter((q) => q.runId === runId));
  }

  async addNotification(n: NotificationInput): Promise<NotificationRecord> {
    const rec: NotificationRecord = { id: this.id("notif"), sentAt: null, readAt: null, createdAt: new Date(), ...clone(n) };
    this.notifications.push(rec);
    return clone(rec);
  }

  async addAudit(e: AuditInput): Promise<void> {
    this.audits.push(clone(e));
  }

  async upsertLesson(l: LessonUpsert): Promise<LessonRecord> {
    const key = `${l.nicheKey}::${l.lessonHash}`;
    const existing = this.lessons.get(key);
    const rec: LessonRecord = existing
      ? {
          ...existing,
          occurrences: existing.occurrences + 1,
          confidence: Math.min(9, existing.confidence + 1),
          status: existing.occurrences + 1 >= 2 ? "active" : "pending",
          evidence: l.evidence ?? existing.evidence,
        }
      : {
          id: this.id("lesson"),
          nicheKey: l.nicheKey,
          lesson: l.lesson,
          lessonHash: l.lessonHash,
          confidence: 1,
          occurrences: 1,
          status: "pending",
          evidence: l.evidence ?? null,
        };
    this.lessons.set(key, rec);
    return clone(rec);
  }

  async listLessons(nicheKey: string, limit = 50): Promise<LessonRecord[]> {
    return clone([...this.lessons.values()].filter((l) => l.nicheKey === nicheKey).slice(0, limit));
  }

  async getSetting(key: string): Promise<unknown | null> {
    return this.settings.has(key) ? clone(this.settings.get(key)) : null;
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    this.settings.set(key, clone(value));
  }

  async listArchiveTitles(channelId: string, limit: number): Promise<string[]> {
    return clone((this.archive.get(channelId) ?? []).slice(-limit).reverse());
  }

  async listScheduledTimes(channelId: string, since: Date): Promise<Date[]> {
    return [...this.runs.values()]
      .filter((r) => r.channelId === channelId && r.scheduledFor !== null && r.scheduledFor >= since)
      .map((r) => clone(r.scheduledFor!));
  }
}
