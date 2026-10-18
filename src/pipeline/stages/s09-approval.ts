/**
 * S9 — Human approval gate. Assembles the one-screen brief (title, hook, QA
 * score, cost, fixes already applied) and PARKS the run: nothing is uploaded
 * before a human approves (COPILOT default; AUTOPILOT still requires S9 once
 * in wave 1).
 */
import { z } from "zod";
import { QaPackSchema } from "../schemas/qa";
import type { SeoPack } from "../schemas/seo";
import type { CheckOutcome } from "../checks";
import { outputOf } from "./_helpers";
import { defineStage, runStageSkill, type StageResult } from "../stage";
import type { approvalSummarizer } from "@/src/skills/s09/approval-summarizer";
import type { ScriptPackage } from "../schemas/script";

export const s09Approval = defineStage({
  key: "S9",
  index: 9,
  title: "Human approval",
  costTier: "free",
  maxAttempts: 2,
  skills: ["approval-summarizer", "rejection-tagger"],

  async gate(ctx) {
    const s8 = ctx.inputs.of("S8");
    if (!s8) return { pass: false, code: "GATE_BLOCKED", reason: "مرحلة الفحص النهائي (S8) لم تكتمل بعد" };
    return { pass: true };
  },

  async execute(ctx): Promise<StageResult> {
    const qa = QaPackSchema.parse(outputOf<unknown>(ctx, "S8"));
    const seo = outputOf<SeoPack>(ctx, "S7");
    const scriptPkg = outputOf<ScriptPackage>(ctx, "S3");
    const s6 = outputOf<{ render: { filePath: string; durationSec: number } }>(ctx, "S6");
    const stages = await ctx.store.listStages(ctx.run.id);
    const fixesApplied = stages.map((s) => s.error).filter((e): e is string => !!e);
    const spent = await ctx.store.ledgerTotal(ctx.run.id);

    const summary = await runStageSkill<z.infer<typeof approvalSummarizer.output>>(ctx, "approval-summarizer", {
      title: seo.chosenTitle,
      thumbnailOverlay: seo.promise.thumbnail,
      hook: scriptPkg.chosenHook,
      score: qa.score,
      costSpentCents: spent,
      costCapCents: ctx.run.costCapCents,
      durationSec: s6.render.durationSec,
      fixesApplied: fixesApplied.slice(0, 20),
      chaptersCount: seo.chapters.length,
      disclosureText: seo.disclosure.text,
    });

    await ctx.notify({
      kind: "approval_needed",
      runId: ctx.run.id,
      userId: ctx.run.userId,
      title: `S9: فيديو جاهز للاعتماد — ${seo.chosenTitle}`,
      body: summary.summary.headline,
      data: { score: qa.score, costSpentCents: spent },
    });

    return {
      output: {
        summary: summary.summary,
        qaScore: qa.score,
        videoFile: s6.render.filePath,
        costSpentCents: spent,
        decision: null,
      },
      score: qa.score,
      requiresHuman: true,
    };
  },

  async validate(_ctx, result): Promise<CheckOutcome[]> {
    const out = result.output as { summary?: { headline?: string } };
    return [
      {
        key: "approval.summary",
        pass: !!out.summary?.headline,
        severity: "fail",
        message: out.summary?.headline ? undefined : "لا يوجد ملخص اعتماد جاهز للعرض",
      },
    ];
  },
});
