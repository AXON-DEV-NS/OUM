/**
 * Provider ports of the pipeline. The engine and every skill talk to these
 * interfaces, never to a concrete vendor SDK. Live adapters live next to this
 * file (llm.ts, media.ts, youtube.ts); tests use stubs.
 */
import type { z } from "zod";
import type { ModelFamily } from "../config";

// ── LLM ─────────────────────────────────────────────────────────

export interface ChatJsonArgs {
  /** stable purpose string (usually the skill key) for logs and stubs */
  purpose: string;
  system: string;
  user: string;
  /** output must parse against this schema — closed contract */
  schema: z.ZodType;
  preferFamily?: ModelFamily;
  maxOutTokens?: number;
  temperature?: number;
}

export interface ChatJsonResult<T = unknown> {
  data: T;
  family: ModelFamily;
  model: string;
  inTokens: number;
  outTokens: number;
  costCents: number;
}

export interface LlmGateway {
  /** configured families, cheapest/primary first */
  families(): Promise<ModelFamily[]>;
  has(f: ModelFamily): Promise<boolean>;
  chatJson<T = unknown>(args: ChatJsonArgs): Promise<ChatJsonResult<T>>;
}

// ── Media (generation adapters are wave 2; the orchestration code is real) ─

export interface GeneratedAsset {
  /** absolute or repo-relative path on the server disk */
  filePath: string;
  bytes: number;
  mimeType: string;
  provider: string;
  /** actual provider-reported cost in cents (0 when free/unknown) */
  costCents: number;
  width?: number;
  height?: number;
  durationSec?: number;
}

export interface MediaGateway {
  name(): string;
  /** false -> stages S5+ park cheaply with a clear reason */
  isConfigured(): boolean;
  reason(): string;
  generateImage(req: { prompt: string; aspect: "16:9" | "9:16"; purpose: string }): Promise<GeneratedAsset>;
  generateVideo(req: { prompt: string; seconds: number; aspect: "16:9" | "9:16"; purpose: string }): Promise<GeneratedAsset>;
  synthesizeVoice(req: { text: string; style: string; rateWpm: number; purpose: string }): Promise<GeneratedAsset>;
  render(req: { editList: unknown; purpose: string }): Promise<GeneratedAsset>;
}

/** bounded page snapshot used by post-publish inspection */
export interface PageSnapshot {
  httpStatus: number;
  contentType: string | null;
  bodyText: string;
}

// ── YouTube ─────────────────────────────────────────────────────

export interface UploadSpec {
  channelId: string;
  filePath: string;
  title: string;
  description: string;
  tags: string[];
  /** always private first — the only allowed first step */
  privacy: "private";
  madeForKids: boolean;
  categoryId?: string;
  disclosure: { altered: boolean; syntheticVoice: boolean };
  idempotencyKey: string;
  scheduledFor?: Date | null;
}

export interface VideoStatus {
  /** raw YouTube status: uploaded | processed | failed | rejected */
  state: string;
  publicUrl: string | null;
  privacy: string | null;
}

export interface ChannelToken {
  accessToken: string;
  expired: boolean;
}

export interface YoutubeGateway {
  configured(channelId: string): Promise<{ ok: boolean; reason?: string }>;
  /** quota units already used today (resets midnight PT) */
  quotaUsed(): Promise<number>;
  uploadPrivate(spec: UploadSpec): Promise<{ videoId: string }>;
  setScheduled(videoId: string, at: Date): Promise<void>;
  setPublic(videoId: string): Promise<void>;
  videoStatus(videoId: string): Promise<VideoStatus>;
}

// ── Notifications ───────────────────────────────────────────────

export interface NotifyInput {
  title: string;
  body: string;
  kind: string;
  runId?: string;
  userId?: string;
  data?: unknown;
}

export type NotifierFn = (n: NotifyInput) => Promise<void>;
