/**
 * Script-package contract (stages S2 + S3 combined artifact).
 */
import { z } from "zod";

export const ClaimSchema = z.strictObject({
  text: z.string().min(8).max(400),
  kind: z.enum(["fact", "statistic", "medical", "financial", "legal", "opinion"]),
  needsSource: z.boolean(),
  sourceUrl: z.string().regex(/^https:\/\/.+/i).optional(),
});

export const IdeaSchema = z.strictObject({
  title: z.string().min(8).max(120),
  angle: z.string().min(10).max(400),
  targetAudience: z.string().min(3).max(200),
  whyNow: z.string().max(300).optional(),
});

export const RetentionBeatSchema = z.strictObject({
  name: z.string().min(2).max(60),
  seconds: z.number().int().min(3).max(600),
  notes: z.string().max(300).optional(),
});

export const ScriptPackageSchema = z.strictObject({
  idea: IdeaSchema,
  hooks: z.array(z.string().min(8).max(140)).min(3).max(6),
  chosenHook: z.string().min(8).max(140),
  script: z.string().min(200),
  structure: z.array(RetentionBeatSchema).min(3).max(20),
  claims: z.array(ClaimSchema).max(30).default([]),
  /** which model family wrote the script (judges must differ) */
  writerFamily: z.string().min(2).max(20),
});

export type ScriptPackage = z.infer<typeof ScriptPackageSchema>;
export type Claim = z.infer<typeof ClaimSchema>;
export type Idea = z.infer<typeof IdeaSchema>;

/** output of the research stage (S2) before the script exists */
export const ResearchPackageSchema = z.strictObject({
  trends: z.array(z.strictObject({ topic: z.string().min(3).max(120), why: z.string().max(300), momentum: z.enum(["rising", "steady", "fading"]) })).min(3).max(12),
  ideas: z.array(IdeaSchema.extend({ score: z.number().int().min(0).max(100), reasons: z.array(z.string().max(200)).max(4) })).min(3).max(10),
  chosen: IdeaSchema,
  series: z.strictObject({
    seriesName: z.string().max(120).nullable(),
    nextEpisodes: z.array(z.string().max(200)).max(5),
  }),
  writerFamily: z.string().min(2).max(20),
});

export type ResearchPackage = z.infer<typeof ResearchPackageSchema>;
