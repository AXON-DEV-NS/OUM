/**
 * QA contracts: judge verdicts and the aggregated QA pack of stage S8.
 */
import { z } from "zod";

export const CheckOutcomeSchema = z.strictObject({
  key: z.string().min(1),
  pass: z.boolean(),
  severity: z.enum(["info", "warn", "fail"]),
  message: z.string().max(600).optional(),
  fix: z.string().max(400).optional(),
  fixStage: z.string().max(8).optional(),
  weight: z.number().min(0).max(10).optional(),
  skipped: z.boolean().optional(),
});

export const JudgeVerdictSchema = z.strictObject({
  pass: z.boolean(),
  score: z.number().int().min(0).max(100),
  reasons: z.array(z.string().max(300)).max(8),
  fixes: z
    .array(z.strictObject({ text: z.string().min(4).max(300), stage: z.string().max(8).optional() }))
    .max(8)
    .default([]),
});

export const QaPackSchema = z.strictObject({
  score: z.number().int().min(0).max(100),
  action: z.enum(["pass", "fix", "hold"]),
  deterministic: z.array(CheckOutcomeSchema).max(200),
  judges: z
    .array(
      z.strictObject({
        key: z.string().min(2).max(60),
        verdict: JudgeVerdictSchema,
        judgeModel: z.string().max(80).optional(),
        writerModel: z.string().max(80).optional(),
      }),
    )
    .max(10),
  fixes: z.array(z.strictObject({ text: z.string().min(4).max(300), stage: z.string().max(8).optional() })).max(20),
});

export type QaPack = z.infer<typeof QaPackSchema>;
export type JudgeVerdict = z.infer<typeof JudgeVerdictSchema>;
