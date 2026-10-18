/**
 * S8 — Final QA (QA2/QA3): the master deterministic checklist + the rights
 * audit + three INDEPENDENT judges (sensitive topics, promise match,
 * originality — none of them the writer's family).
 *
 * Aggregate = deterministic * (1 - judgeWeight) + judges * judgeWeight.
 *   action pass  -> onward (score >= passScore)
 *   action fix   -> retry with fixes (the engine may rewind a stage)
 *   action hold  -> park for a human (never publish below the fix floor)
 */
import { z } from "zod";
import { CONFIG } from "../config";
import { validationFailed } from "../errors";
import { QaPackSchema } from "../schemas/qa";
import type { CheckOutcome } from "../checks";
import type { SeoPack } from "../schemas/seo";
import type { ScriptPackage } from "../schemas/script";
import type { EditList } from "../schemas/storyboard";
import { dnaJson, outputOf } from "./_helpers";
import { defineStage, runStageSkill, type StageResult } from "../stage";
import type { deterministicChecklist } from "@/src/skills/s08/deterministic-checklist";
import type { rightsChecker } from "@/src/skills/s08/rights-checker";
import type { sensitiveTopicsGuard } from "@/src/skills/s08/sensitive-topics-guard";
import type { promiseMatchJudge } from "@/src/skills/s08/promise-match-judge";
import type { originalityJudge } from "@/src/skills/s08/originality-judge";

type DetOutcome = z.infer<typeof deterministicChecklist.output>["outcomes"][number];

export const s08FinalQa = defineStage({
  key: "S8",
  index: 8,
  title: "Final QA (QA2/QA3)",
  costTier: "text",
  maxAttempts: 3,
  needsJudge: true,
  skills: ["deterministic-checklist", "rights-checker", "sensitive-topics-guard", "promise-match-judge", "originality-judge"],

  async gate(ctx) {
    const families = await ctx.llm.families();
    if (families.length < 2) {
      return {
        pass: false,
        code: "JUDGE_UNAVAILABLE",
        reason: `القاضي غير الكاتب: نحتاج عائلتي نماذج مستقلتين على الأقل (المتوفر: ${families.join(", ") || "لا شيء"}) — أضف مفتاح مزوّد ثانٍ`,
      };
    }
    return { pass: true };
  },

  async execute(ctx): Promise<StageResult> {
    const dna = dnaJson(ctx);
    const seo = outputOf<SeoPack>(ctx, "S7");
    const scriptPkg = outputOf<ScriptPackage>(ctx, "S3");
    const renderOut = outputOf<{ editList: EditList; render: { filePath: string; durationSec: number } }>(ctx, "S6");
    const archive = await ctx.store.listArchiveTitles(ctx.run.channelId, CONFIG.similarity.archiveTitles);
    const assets = await ctx.store.listAssets(ctx.run.id);
    const writerFamily = scriptPkg.writerFamily;

    const det = await runStageSkill<z.infer<typeof deterministicChecklist.output>>(ctx, "deterministic-checklist", {
      title: seo.chosenTitle,
      description: seo.description,
      tags: seo.tags,
      script: scriptPkg.script,
      hooks: scriptPkg.hooks,
      chapters: seo.chapters.map((c) => ({ at: c.at, label: c.label })),
      thumbnails: seo.thumbnails.map((t) => ({ overlayText: t.overlayText })),
      expectedDurationSec: renderOut.render.durationSec,
      plannedDurationSec: renderOut.editList.totalSeconds,
      targetMinutes: dna.mode.format.targetMinutes,
      archive,
    });

    const rights = await runStageSkill<z.infer<typeof rightsChecker.output>>(ctx, "rights-checker", {
      assets: assets.map((a) => ({
        assetId: a.id,
        kind: a.kind,
        source: (["generated", "licensed", "uploaded"] as const).includes(a.source as never)
          ? (a.source as "generated" | "licensed" | "uploaded")
          : ("uploaded" as const),
        provider: a.provider,
        license: a.license,
        licenseUrl: a.licenseUrl,
        filePath: a.filePath,
      })),
    });

    const excerpt = scriptPkg.script.slice(0, 2000);
    const sensitive = await runStageSkill<z.infer<typeof sensitiveTopicsGuard.output>>(ctx, "sensitive-topics-guard", {
      title: seo.chosenTitle,
      description: seo.description,
      scriptExcerpt: excerpt,
      writerFamily,
    });
    const promise = await runStageSkill<z.infer<typeof promiseMatchJudge.output>>(ctx, "promise-match-judge", {
      title: seo.chosenTitle,
      thumbnailText: seo.promise.thumbnail,
      scriptExcerpt: excerpt,
      writerFamily,
    });
    const originality = await runStageSkill<z.infer<typeof originalityJudge.output>>(ctx, "originality-judge", {
      title: seo.chosenTitle,
      scriptExcerpt: excerpt,
      archiveTitles: archive,
      writerFamily,
    });

    const allDet: DetOutcome[] = [...det.outcomes];
    if (!rights.ok) {
      allDet.push({
        key: "rights.assets",
        pass: false,
        severity: "fail",
        message: rights.issues.slice(0, 3).map((i) => i.problem).join("؛ "),
        fix: "استكمل بيانات المزوّد/الترخيص للأصول",
      });
    }
    const executed = allDet.filter((o) => !o.skipped);
    const totalW = executed.reduce((s, o) => s + (o.weight ?? 1), 0);
    const passW = executed.reduce((s, o) => s + (o.severity !== "fail" || o.pass ? (o.weight ?? 1) : 0), 0);
    const detScore = totalW === 0 ? 100 : Math.round((passW / totalW) * 100);
    const detPass = allDet.every((o) => o.severity !== "fail" || o.pass);

    const judges = [
      { key: "sensitive-topics-guard", out: sensitive },
      { key: "promise-match-judge", out: promise },
      { key: "originality-judge", out: originality },
    ];
    const judgeScore = Math.round(judges.reduce((s, j) => s + j.out.verdict.score, 0) / judges.length);
    const judgesPass = judges.every((j) => j.out.verdict.pass && j.out.verdict.score >= CONFIG.qa.judgePassScore);
    const weighted = Math.round(detScore * (1 - CONFIG.qa.judgeWeight) + judgeScore * CONFIG.qa.judgeWeight);

    const fixes = [
      ...allDet
        .filter((o) => o.severity === "fail" && !o.pass)
        .map((o) => ({ text: (o.fix ?? o.message ?? "فحص فاشل").slice(0, 300), stage: o.fixStage })),
      ...judges.flatMap((j) => j.out.verdict.fixes.map((f) => ({ text: f.text, stage: f.stage }))),
    ].slice(0, 20);

    const action = detPass && judgesPass && weighted >= CONFIG.qa.passScore ? "pass" : weighted >= CONFIG.qa.fixFloor ? "fix" : "hold";

    const pack = {
      score: weighted,
      action,
      deterministic: allDet.slice(0, 200),
      judges: judges.map((j) => ({
        key: j.key,
        verdict: j.out.verdict,
        judgeModel: j.out.judgeModel,
        writerModel: writerFamily,
      })),
      fixes,
    };
    const parsed = QaPackSchema.safeParse(pack);
    if (!parsed.success) throw validationFailed("QA pack invalid", parsed.error.issues.slice(0, 5));

    for (const o of allDet.filter((x) => x.severity !== "info")) {
      await ctx.recordQa({
        checkKey: `qa2:${o.key}`,
        kind: "deterministic",
        passed: o.pass,
        reasons: { message: o.message ?? null, fix: o.fix ?? null },
        action: o.severity,
      });
    }
    for (const j of judges) {
      await ctx.recordQa({
        checkKey: `judge:${j.key}`,
        kind: "judge",
        score: j.out.verdict.score,
        passed: j.out.verdict.pass,
        reasons: { reasons: j.out.verdict.reasons },
        judgeModel: j.out.judgeModel,
        writerModel: writerFamily,
        action: j.out.verdict.pass ? "pass" : "fail",
      });
    }

    if (action === "fix") {
      return {
        output: parsed.data,
        score: weighted,
        retry: { reason: `QA2: النتيجة ${weighted} (حد العبور ${CONFIG.qa.passScore})`, fixes },
      };
    }
    if (action === "hold") {
      return {
        output: parsed.data,
        score: weighted,
        hold: { kind: "qa", reason: `النتيجة ${weighted} أقل من حد الإصلاح ${CONFIG.qa.fixFloor} — تحتاج قراراً بشرياً` },
      };
    }
    return { output: parsed.data, score: weighted, checkpoint: { qaScore: weighted } };
  },

  async validate(_ctx, result): Promise<CheckOutcome[]> {
    const out = result.output as Partial<z.infer<typeof QaPackSchema>>;
    const parsed = QaPackSchema.safeParse(out);
    const issues: CheckOutcome[] = [];
    if (!parsed.success) {
      issues.push({ key: "qa.schema", pass: false, severity: "fail", message: `حزمة QA غير صالحة: ${parsed.error.issues[0]?.message}` });
      return issues;
    }
    if (parsed.data.action === "pass") {
      issues.push({ key: "qa.pass", pass: true, severity: "info", message: `QA ${parsed.data.score}/100` });
    }
    return issues;
  },
});
