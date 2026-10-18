/**
 * Central configuration for the OUM pipeline engine (constitution doc V1).
 *
 * Every number that a deterministic check or a gate enforces lives HERE.
 * Deterministic checks must never depend on a language model, and money floors
 * must be reviewable in one place. Runtime overrides are possible through the
 * SystemSetting("pipeline:config") key — see runtime.ts.
 */

export type ModelFamily = "deepseek" | "openai";

export interface ModelPrice {
  /** cents per 1M input tokens (USD) */
  in: number;
  /** cents per 1M output tokens (USD) */
  out: number;
}

export const CONFIG = {
  stages: 13,

  qa: {
    /** final QA score >= passScore -> proceed */
    passScore: 85,
    /** passScore > score >= fixFloor -> auto-fix retries */
    fixFloor: 70,
    /** maximum auto-fix retries before holding for humans */
    maxFixRetries: 2,
    /** aggregate = deterministic * (1 - judgeWeight) + judges * judgeWeight */
    judgeWeight: 0.5,
    /** original judge verdicts below this are fix-level */
    judgePassScore: 80,
  },

  cost: {
    /** default per-run budget when the caller does not set one */
    defaultCapCents: 1500,
    /** refuse to start a run with a cap below this (fail cheap, up front) */
    minimumCapCents: 200,
    /** price used when a model is not in the table (deliberately conservative) */
    fallbackPrice: { in: 150, out: 450 } satisfies ModelPrice,
  },

  /**
   * VERIFY BEFORE REAL SPEND: provider prices change.
   * Format: cents per 1M tokens. Update from the provider pricing pages.
   */
  prices: {
    deepseek: {
      "deepseek-chat": { in: 27, out: 110 },
    },
    openai: {
      "gpt-4o-mini": { in: 15, out: 60 },
    },
  } as Record<string, Record<string, ModelPrice>>,

  models: {
    /** first family that is configured becomes the writer; judges must differ */
    writerPreference: ["deepseek", "openai"] as ModelFamily[],
    defaultModel: { deepseek: "deepseek-chat", openai: "gpt-4o-mini" } as Record<ModelFamily, string>,
    chatTimeoutMs: 90_000,
    maxOutTokensDefault: 2500,
    temperatureDefault: 0.7,
  },

  /** Rough estimates used to reserve budget before media work starts (cents). */
  mediaEstimates: {
    imageCents: 4,
    ttsPer1kCharsCents: 15,
    videoPerSecondCents: 25,
    renderPerMinuteCents: 60,
  },

  lufs: { target: -14, tolerance: 1 },

  video: {
    minShortSide: 1080,
    durationTolerancePct: 0.2,
    blackFrameMaxPct: 0.5,
  },

  lengths: {
    titleMinChars: 8,
    titleMaxChars: 100,
    descriptionMinChars: 80,
    descriptionMaxChars: 5000,
    tagsMaxTotalChars: 500,
    hookMinChars: 10,
    hookMaxChars: 120,
    overlayMaxWords: 4,
    chaptersMin: 3,
    lessonMaxChars: 240,
    scriptMinWords: 120,
    scriptMaxWords: 6000,
    scriptWpmLow: 100,
    scriptWpmHigh: 200,
  },

  similarity: {
    /** above this vs the channel archive -> duplicate, block */
    duplicateThreshold: 0.72,
    archiveTitles: 50,
  },

  schedule: {
    /** default delay before publishing when the scheduler has no data */
    defaultOffsetMinutes: 40,
    /** minimum gap between two runs on the same channel (hours) */
    minGapHours: 20,
    /** candidate UTC hours used until real analytics exist */
    defaultSlotsUtc: [14, 17, 20],
  },

  postPublish: [
    { key: "p10m", afterMinutes: 10 },
    { key: "p2h", afterMinutes: 120 },
    { key: "p48h", afterMinutes: 2880 },
    { key: "p7d", afterMinutes: 10080 },
  ],

  retention: {
    notificationDays: 90,
    backupFiles: 10,
  },

  network: {
    timeoutMs: 10_000,
    maxBytes: 2_000_000,
    maxRedirects: 3,
  },

  /** Reserved for the sensitive-topics guard; extend per market with sources. */
  sensitiveKeywords: [
    "guaranteed income", "guaranteed results", "get rich", "no risk",
    "miracle cure", "100% safe", "insider trading", "double your money",
  ],

  /** Tier names in increasing cost order. The engine enforces the order. */
  tiers: ["free", "text", "image", "video", "publish"] as const,
} as const;

export type PipelineConfig = typeof CONFIG;

/** cents per 1M tokens for a provider/model pair (falls back conservatively) */
export function priceFor(family: string, model: string): ModelPrice {
  const table = CONFIG.prices as Record<string, Record<string, ModelPrice>>;
  return table[family]?.[model] ?? CONFIG.cost.fallbackPrice;
}

export function estimateChatCents(family: string, model: string, inTokens: number, outTokens: number): number {
  const p = priceFor(family, model);
  return Math.ceil((inTokens * p.in + outTokens * p.out) / 1_000_000);
}
