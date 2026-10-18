/**
 * Channel DNA contracts (stage S0 output, approved by the client before any
 * production starts — "هذا ما فهمته" gate).
 */
import { z } from "zod";

export const RuleSchema = z.strictObject({
  id: z.string().min(1).max(40),
  text: z.string().min(2).max(400),
  kind: z.enum(["tone", "format", "forbidden", "required", "audience", "style"]),
  source: z.enum(["instruction", "platform", "user"]),
  /** hard rules block; soft rules guide */
  hard: z.boolean(),
});

export const RuleConflictSchema = z.strictObject({
  a: z.string().min(1),
  b: z.string().min(1),
  severity: z.enum(["low", "high"]),
  resolution: z.string().max(300).optional(),
});

export const CompetitorSchema = z.strictObject({
  url: z.string().regex(/^https:\/\/.+/i, "https URL required"),
  strengths: z.array(z.string().max(200)).max(6),
  weaknesses: z.array(z.string().max(200)).max(6),
});

export const AudienceSchema = z.strictObject({
  summary: z.string().min(20).max(600),
  markets: z.array(z.string().min(2).max(12)).min(1).max(10),
  languages: z.array(z.string().min(2).max(12)).min(1).max(10),
  pains: z.array(z.string().max(200)).max(8),
  desires: z.array(z.string().max(200)).max(8),
});

export const AvatarSchema = z.strictObject({
  description: z.string().max(600).optional(),
  imageOk: z.boolean().optional(),
  imageIssues: z.array(z.string().max(200)).max(10).optional(),
});

export const RunPathSchema = z.enum(["AVATAR", "FACELESS", "MIXED"]);

export const DnaModeSchema = z.strictObject({
  path: RunPathSchema,
  voiceStyle: z.string().max(200).optional(),
  format: z.strictObject({
    vertical: z.boolean(),
    targetMinutes: z.number().min(0.5).max(60),
  }),
});

export const ChannelDnaSchema = z.strictObject({
  rules: z.array(RuleSchema).min(3).max(120),
  conflicts: z.array(RuleConflictSchema).max(30).default([]),
  competitors: z.array(CompetitorSchema).max(10).default([]),
  audience: AudienceSchema,
  avatar: AvatarSchema.optional(),
  mode: DnaModeSchema,
});

export type ChannelDnaJson = z.infer<typeof ChannelDnaSchema>;
export type Rule = z.infer<typeof RuleSchema>;
export type RuleConflict = z.infer<typeof RuleConflictSchema>;
