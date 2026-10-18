/**
 * Storage port of the pipeline engine.
 *
 * The engine, the guards and every skill talk ONLY to this interface.
 * Two implementations exist:
 *   - prisma-store.ts  → production (PostgreSQL via Prisma)
 *   - memory-store.ts  → tests and dry-runs
 *
 * Status string unions mirror the Prisma enums (runs.RunStatus etc.) but are
 * declared here so the domain layer never imports the generated client.
 */

export type RunStatus = "QUEUED" | "RUNNING" | "WAITING_HUMAN" | "HOLD" | "FAILED" | "PUBLISHED" | "DONE";
export type StageStatus = "PENDING" | "RUNNING" | "PASSED" | "FAILED" | "RETRY" | "SKIPPED" | "WAITING";
export type RunPath = "AVATAR" | "FACELESS" | "MIXED";
export type RunMode = "COPILOT" | "AUTOPILOT";

export interface RunRecord {
  id: string;
  userId: string;
  channelId: string;
  nicheKey: string | null;
  path: RunPath;
  mode: RunMode;
  status: RunStatus;
  currentStage: number;
  costCapCents: number;
  costSpentCents: number;
  locale: string;
  scheduledFor: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StageRecord {
  id: string;
  runId: string;
  stageKey: string;
  index: number;
  status: StageStatus;
  attempts: number;
  checkpoint: Record<string, unknown>;
  input: unknown;
  output: unknown;
  score: number | null;
  skillVersions: Record<string, string> | null;
  error: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  durationMs: number | null;
}

export interface DnaRecord {
  id: string;
  channelId: string;
  version: number;
  rules: unknown;
  conflicts: unknown;
  competitors: unknown;
  audience: unknown;
  avatar: unknown;
  mode: unknown;
  approvedAt: Date | null;
  approvedBy: string | null;
}

export interface DnaUpsert {
  rules: unknown;
  conflicts?: unknown;
  competitors?: unknown;
  audience?: unknown;
  avatar?: unknown;
  mode: unknown;
}

/** everything stages need to know about the channel + its owner */
export interface ChannelContext {
  id: string;
  userId: string;
  title: string;
  niche: string | null;
  markets: string[];
  tone: string | null;
  requiresAvatar: boolean;
  avatarImageBytes: number | null;
  avatarImageBuffer: Uint8Array | null;
  avatarImageMime: string | null;
  referenceChannelUrl: string | null;
  referenceVideoUrl: string | null;
  hasAccessToken: boolean;
  tokenExpired: boolean;
  customInstructions: string | null;
}

export interface AssetRecord {
  id: string;
  runId: string;
  kind: string;
  stage: string | null;
  filePath: string | null;
  mimeType: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  source: string;
  provider: string | null;
  license: string | null;
  licenseUrl: string | null;
  meta: unknown;
}

export type AssetInput = Omit<AssetRecord, "id">;

export interface LedgerInput {
  runId: string;
  stageKey: string;
  provider: string;
  operation: string;
  units?: unknown;
  costCents: number;
  currency?: string;
  meta?: unknown;
}

export interface QaInput {
  runId: string;
  stageKey: string;
  stageRowId?: string;
  checkKey: string;
  kind: "deterministic" | "judge" | "gate";
  score?: number;
  passed: boolean;
  reasons?: unknown;
  action?: string;
  judgeModel?: string;
  writerModel?: string;
}

export interface QaRecord extends QaInput {
  id: string;
  createdAt: Date;
}

export interface NotificationInput {
  userId?: string;
  runId?: string;
  channel: "in_app" | "telegram";
  kind: string;
  title: string;
  body: string;
  data?: unknown;
}

export interface NotificationRecord extends NotificationInput {
  id: string;
  sentAt: Date | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface AuditInput {
  action: string;
  actorId: string;
  actorRole?: string;
  targetUserId?: string;
  metadata?: unknown;
  ipAddress?: string;
}

export interface LessonUpsert {
  nicheKey: string;
  lesson: string;
  lessonHash: string;
  evidence?: unknown;
  source?: string;
  channelId?: string;
}

export interface LessonRecord {
  id: string;
  nicheKey: string;
  lesson: string;
  lessonHash: string;
  confidence: number;
  occurrences: number;
  status: string;
  evidence: unknown;
}

export interface RunListFilter {
  statuses?: RunStatus[];
  /** runs whose scheduledFor is at or before this instant (S10 timing) */
  scheduledBefore?: Date;
  /** runs not updated since this instant (stuck-run recovery) */
  staleBefore?: Date;
  limit?: number;
}

/** CAS lock request: only succeed when the stage is currently in one of `from`. */
export interface StagePatch {
  status?: StageStatus;
  attempts?: number;
  checkpoint?: Record<string, unknown>;
  input?: unknown;
  output?: unknown;
  score?: number;
  skillVersions?: Record<string, string>;
  error?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  durationMs?: number | null;
}

export interface RunPatch {
  status?: RunStatus;
  currentStage?: number;
  costSpentCents?: number;
  scheduledFor?: Date | null;
  lastError?: string | null;
  nicheKey?: string | null;
  mode?: RunMode;
}

export interface CreateRunInput {
  userId: string;
  channelId: string;
  path: RunPath;
  mode?: RunMode;
  costCapCents: number;
  locale?: string;
  nicheKey?: string | null;
  status?: RunStatus;
  scheduledFor?: Date | null;
  idempotencyKey?: string | null;
}

export interface PipelineStore {
  createRun(input: CreateRunInput): Promise<RunRecord>;
  getRun(id: string): Promise<RunRecord | null>;
  updateRun(id: string, patch: RunPatch): Promise<RunRecord>;
  listRuns(filter: RunListFilter): Promise<RunRecord[]>;
  countRuns(filter: { userId?: string; channelId?: string; statuses?: RunStatus[] }): Promise<number>;

  getDna(channelId: string): Promise<DnaRecord | null>;
  upsertDna(channelId: string, data: DnaUpsert): Promise<DnaRecord>;
  approveDna(channelId: string, actorId: string): Promise<void>;
  getChannelContext(channelId: string): Promise<ChannelContext | null>;

  listStages(runId: string): Promise<StageRecord[]>;
  getStage(runId: string, stageKey: string): Promise<StageRecord | null>;
  /** create the row if missing (idempotent), returns the row */
  ensureStage(runId: string, stageKey: string, index: number): Promise<StageRecord>;
  updateStage(runId: string, stageKey: string, patch: StagePatch): Promise<StageRecord>;
  /** CAS: move the stage from any of `from` to RUNNING and bump attempts */
  lockStage(runId: string, stageKey: string, from: StageStatus[]): Promise<boolean>;
  /** reset a stage and everything after it to PENDING (human edit loop) */
  resetStagesFrom(runId: string, fromIndex: number, note?: string): Promise<void>;

  addAsset(a: AssetInput): Promise<AssetRecord>;
  listAssets(runId: string): Promise<AssetRecord[]>;

  appendLedger(e: LedgerInput): Promise<void>;
  ledgerTotal(runId: string): Promise<number>;

  addQa(q: QaInput): Promise<void>;
  listQa(runId: string): Promise<QaRecord[]>;

  addNotification(n: NotificationInput): Promise<NotificationRecord>;

  addAudit(e: AuditInput): Promise<void>;

  /** merge a lesson into niche_kb (occurrences++ on hash collision) */
  upsertLesson(l: LessonUpsert): Promise<LessonRecord>;
  listLessons(nicheKey: string, limit?: number): Promise<LessonRecord[]>;

  getSetting(key: string): Promise<unknown | null>;
  setSetting(key: string, value: unknown): Promise<void>;

  /** recent titles published on this channel (dedup + originality sources) */
  listArchiveTitles(channelId: string, limit: number): Promise<string[]>;
  /** scheduled publication instants on this channel, after `since` */
  listScheduledTimes(channelId: string, since: Date): Promise<Date[]>;
}
