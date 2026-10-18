/**
 * S11 — Post-publish checks on a TIMELINE (p10m / p2h / p48h / p7d).
 * Each check inspects the PUBLIC page (bounded fetch, SSRF-guarded) and
 * verifies it is reachable, real HTML, and not taken down. The run parks
 * between checkpoints (hold timing) and the scheduler wakes it — this is why
 * the engine is built for catch-up ticks, not minute-precise cron.
 * first-hours-agent / ctr-doctor are wave-2 (YouTube Analytics API).
 */
import type { SeoPack } from "../schemas/seo";
import type { CheckOutcome } from "../checks";
import { CONFIG } from "../config";
import { outputOf } from "./_helpers";
import { defineStage, runStageSkill, type StageResult } from "../stage";
import type { publicPageInspector } from "@/src/skills/s11/public-page-inspector";
import type { z } from "zod";
import type { PageSnapshot } from "../providers/types";

interface S11Checkpoint {
  publishedAtIso?: string;
  done?: string[];
}

interface S10Output {
  videoId: string;
  publicUrl?: string;
  scheduledForIso?: string;
}

export const s11PostPublish = defineStage({
  key: "S11",
  index: 11,
  title: "Post-publish checks",
  costTier: "free",
  maxAttempts: 3,
  skills: ["public-page-inspector", "first-hours-agent", "ctr-doctor"],

  async gate(ctx) {
    const s10 = ctx.inputs.of("S10") as S10Output | null;
    if (!s10?.videoId) return { pass: false, code: "GATE_BLOCKED", reason: "لم يُنشر فيديو بعد (S10)" };
    return { pass: true };
  },

  async execute(ctx): Promise<StageResult> {
    const s10 = outputOf<S10Output>(ctx, "S10");
    const seo = ctx.inputs.of("S7") as SeoPack | null;
    const checkpoint = ctx.stageRow.checkpoint as S11Checkpoint;
    const done = new Set(checkpoint.done ?? []);
    const now = ctx.now();
    const scheduledAt = s10.scheduledForIso ? new Date(s10.scheduledForIso) : null;
    const publishedAtIso =
      checkpoint.publishedAtIso ??
      (scheduledAt && scheduledAt.getTime() <= now.getTime() ? scheduledAt.toISOString() : now.toISOString());
    const publishedAt = new Date(publishedAtIso);

    const checks: Array<{ key: string; ok: boolean; message: string }> = [];
    const findings: string[] = [];

    for (const cp of CONFIG.postPublish) {
      if (done.has(cp.key)) continue;
      const dueAt = new Date(publishedAt.getTime() + cp.afterMinutes * 60_000);
      if (now.getTime() < dueAt.getTime()) continue;

      const status = await ctx.youtube.videoStatus(s10.videoId);
      const publicUrl = status.publicUrl ?? s10.publicUrl ?? `https://www.youtube.com/watch?v=${s10.videoId}`;
      let snapshot: PageSnapshot | null = null;
      try {
        snapshot = await ctx.fetchPage(publicUrl);
      } catch {
        snapshot = null;
      }
      const inspection = await runStageSkill<z.infer<typeof publicPageInspector.output>>(ctx, "public-page-inspector", {
        publicUrl,
        expectedTitle: seo?.chosenTitle,
        pageSnapshot: snapshot,
      });
      checks.push(...inspection.checks);
      if (!inspection.ok) {
        return {
          output: { videoId: s10.videoId, publishedAtIso, checks, findings, done: [...done] },
          checkpoint: { publishedAtIso, done: [...done] },
          hold: {
            kind: "qa",
            reason: `فحص ما بعد النشر (${cp.key}) رصد مشكلة: ${inspection.checks.filter((c) => !c.ok).map((c) => c.message).slice(0, 3).join("؛ ")}`,
          },
        };
      }
      findings.push(`${cp.key}: الصفحة العامة سليمة؛ first-hours-agent/ctr-doctor مؤجلان للموجة الثانية (YouTube Analytics)`);
      done.add(cp.key);
    }

    const remaining = CONFIG.postPublish.filter((c) => !done.has(c.key));
    if (remaining.length) {
      const nextDue = new Date(publishedAt.getTime() + remaining[0].afterMinutes * 60_000);
      return {
        output: { videoId: s10.videoId, publishedAtIso, checks, findings, done: [...done], nextDueIso: nextDue.toISOString() },
        checkpoint: { publishedAtIso, done: [...done] },
        hold: {
          kind: "timing",
          reason: `فحوص ما بعد النشر: التالي (${remaining[0].key}) عند ${nextDue.toISOString()}`,
          wakeAtIso: nextDue.toISOString(),
        },
      };
    }

    return {
      output: {
        videoId: s10.videoId,
        publishedAtIso,
        publicUrl: s10.publicUrl ?? `https://www.youtube.com/watch?v=${s10.videoId}`,
        checks,
        findings,
        done: [...done],
      },
      checkpoint: { publishedAtIso, done: [...done] },
    };
  },

  async validate(_ctx, result): Promise<CheckOutcome[]> {
    const out = result.output as { videoId?: string; checks?: Array<{ ok: boolean }> };
    const failed = (out.checks ?? []).filter((c) => !c.ok).length;
    return [
      {
        key: "postpublish.checks",
        pass: !!out.videoId && failed === 0,
        severity: "fail",
        message: !out.videoId ? "لا يوجد فيديو منشور" : failed ? `${failed} فحص ما بعد النشر فاشل` : undefined,
      },
    ];
  },
});
