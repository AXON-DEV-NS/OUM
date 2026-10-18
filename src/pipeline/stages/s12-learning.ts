/**
 * S12 — Learning: distill THIS run's evidence (QA failures, judge verdicts,
 * rejection tags, post-publish findings, cost) into reusable niche lessons and
 * merge them into niche_kb (occurrence-counted). The weekly owner report is a
 * separate scheduled job (see app/api/cron/pipeline-tick + report helper).
 */
import { z } from "zod";
import { contentHash } from "@/src/skills/_common";
import type { SeoPack } from "../schemas/seo";
import type { CheckOutcome } from "../checks";
import { defineStage, runStageSkill, type StageResult } from "../stage";
import type { lessonExtractor } from "@/src/skills/s12/lesson-extractor";

export const s12Learning = defineStage({
  key: "S12",
  index: 12,
  title: "Learning",
  costTier: "free",
  maxAttempts: 2,
  skills: ["lesson-extractor", "weekly-report-writer"],

  async gate(ctx) {
    const families = await ctx.llm.families();
    if (families.length === 0) return { pass: false, code: "PROVIDER_MISSING", reason: "لا يوجد مزوّد نماذج لاستخراج الدروس" };
    return { pass: true };
  },

  async execute(ctx): Promise<StageResult> {
    const seo = ctx.inputs.of("S7") as SeoPack | null;
    const nicheKey = ctx.run.nicheKey ?? ctx.channel?.niche ?? "general";
    const stages = await ctx.store.listStages(ctx.run.id);
    const qa = await ctx.store.listQa(ctx.run.id);

    const stageScores: Record<string, number> = {};
    for (const s of stages) if (typeof s.score === "number") stageScores[s.stageKey] = s.score;

    const failures = qa
      .filter((q) => (q.kind === "judge" ? !q.passed : q.action === "fail"))
      .map((q) => `${q.stageKey}/${q.checkKey}: ${JSON.stringify(q.reasons ?? {}).slice(0, 160)}`)
      .slice(0, 25);
    const warnings = qa
      .filter((q) => q.action === "warn")
      .map((q) => `${q.stageKey}/${q.checkKey}: ${JSON.stringify(q.reasons ?? {}).slice(0, 160)}`)
      .slice(0, 25);

    const s9 = await ctx.store.getStage(ctx.run.id, "S9");
    const rejection = (s9?.checkpoint as { rejection?: { tags?: string[] } } | undefined)?.rejection;
    const s11 = ctx.inputs.of("S11") as { findings?: string[] } | null;
    const costCents = await ctx.store.ledgerTotal(ctx.run.id);

    const out = await runStageSkill<z.infer<typeof lessonExtractor.output>>(ctx, "lesson-extractor", {
      nicheKey,
      runSummary: {
        title: seo?.chosenTitle ?? `run ${ctx.run.id}`,
        stageScores,
        failures,
        warnings,
        rejectionTags: rejection?.tags ?? [],
        postPublishFindings: s11?.findings ?? [],
        costCents,
      },
    });

    const saved: Array<{ lesson: string; lessonHash: string; occurrences: number }> = [];
    for (const l of out.lessons) {
      const lessonHash = contentHash(l.lesson);
      const rec = await ctx.store.upsertLesson({
        nicheKey,
        lesson: l.lesson,
        lessonHash,
        evidence: { runId: ctx.run.id, evidenceText: l.evidenceText, confidence: l.confidence },
        source: "S12",
        channelId: ctx.run.channelId,
      });
      saved.push({ lesson: l.lesson, lessonHash, occurrences: rec.occurrences });
    }

    return {
      output: { nicheKey, lessons: saved, evidenceCounts: { failures: failures.length, warnings: warnings.length, costCents } },
      checkpoint: { lessonsSaved: saved.length },
    };
  },

  async validate(_ctx, result): Promise<CheckOutcome[]> {
    const out = result.output as { lessons?: unknown[] };
    const n = out.lessons?.length ?? 0;
    return [
      {
        key: "learning.lessons",
        pass: n >= 1,
        severity: "fail",
        message: n >= 1 ? `${n} درساً محفوظاً` : "لم يتم استخراج أي درس من هذا التشغيل",
        fix: "أعد استخراج الدروس مع أدلة أوضح",
        fixStage: "S12",
      },
    ];
  },
});
