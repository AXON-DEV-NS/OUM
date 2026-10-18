/**
 * S10 — Publish, private-first. The only stage allowed to touch YouTube:
 *   1. the upload spec is built and validated in code (upload-guard)
 *   2. the publish instant comes from best-time-scheduler (conflict-aware)
 *   3. the video is uploaded PRIVATE (idempotent via checkpoint.videoId)
 *   4. publication is scheduled; the run parks (hold timing) until the instant
 *   5. on resume the status is verified and the video flips public explicitly
 * Money-honest: YouTube quota is free, so no ledger rows are written here.
 */
import { z } from "zod";
import type { QaPack } from "../schemas/qa";
import type { SeoPack } from "../schemas/seo";
import type { CheckOutcome } from "../checks";
import { outputOf } from "./_helpers";
import { defineStage, runStageSkill, type StageResult } from "../stage";
import type { uploadGuard } from "@/src/skills/s10/upload-guard";
import type { bestTimeScheduler } from "@/src/skills/s10/best-time-scheduler";

interface S10Checkpoint {
  videoId?: string;
  scheduledForIso?: string;
  scheduled?: boolean;
}

export const s10Publish = defineStage({
  key: "S10",
  index: 10,
  title: "Publish (private-first)",
  costTier: "publish",
  maxAttempts: 3,
  skills: ["upload-guard", "best-time-scheduler"],

  async gate(ctx) {
    const yt = await ctx.youtube.configured(ctx.run.channelId);
    if (!yt.ok) {
      return { pass: false, code: "PROVIDER_MISSING", reason: yt.reason ?? "قناة يوتيوب غير مربوطة (OAuth مفقود)" };
    }
    const s8 = ctx.inputs.of("S8") as QaPack | null;
    if (!s8 || s8.action !== "pass") {
      return { pass: false, code: "GATE_BLOCKED", reason: "الفحص النهائي (S8) لم يُجتَز بعد" };
    }
    return { pass: true };
  },

  async execute(ctx): Promise<StageResult> {
    const seo = outputOf<SeoPack>(ctx, "S7");
    const s6 = outputOf<{ render: { filePath: string; durationSec: number } }>(ctx, "S6");
    const checkpoint = ctx.stageRow.checkpoint as S10Checkpoint;
    const now = ctx.now();
    const stageKey = ctx.stageRow.stageKey;

    const guard = await runStageSkill<z.infer<typeof uploadGuard.output>>(ctx, "upload-guard", {
      runId: ctx.run.id,
      channelId: ctx.run.channelId,
      title: seo.chosenTitle,
      description: seo.description,
      tags: seo.tags,
      filePath: s6.render.filePath,
      scheduledForIso: checkpoint.scheduledForIso ?? null,
      disclosureRequired: seo.disclosure.required,
      disclosureText: seo.disclosure.text,
      madeForKids: false,
    });
    if (!guard.ok) {
      return {
        output: guard,
        retry: {
          reason: guard.problems.join("؛ "),
          fixes: guard.problems.map((p) => ({ text: p.slice(0, 300), stage: "S7" })),
        },
      };
    }

    // ── publish instant (stable across retries) ──
    let scheduledIso = checkpoint.scheduledForIso ?? null;
    if (!scheduledIso) {
      const existing = await ctx.store.listScheduledTimes(ctx.run.channelId, new Date(now.getTime() - 3_600_000));
      const sched = await runStageSkill<z.infer<typeof bestTimeScheduler.output>>(ctx, "best-time-scheduler", {
        nowIso: now.toISOString(),
        existingTimesIso: existing.map((d) => d.toISOString()),
        preferredIso: ctx.run.scheduledFor ? ctx.run.scheduledFor.toISOString() : guard.spec.scheduledForIso,
      });
      scheduledIso = sched.scheduledForIso;
      await ctx.store.updateStage(ctx.run.id, stageKey, { checkpoint: { scheduledForIso: scheduledIso } });
    }

    // ── upload once, PRIVATE, checkpointed right after the side effect ──
    let videoId = checkpoint.videoId ?? null;
    if (!videoId) {
      const up = await ctx.youtube.uploadPrivate({
        channelId: ctx.run.channelId,
        filePath: guard.spec.filePath,
        title: guard.spec.title,
        description: guard.spec.descriptionWithDisclosure,
        tags: guard.spec.tags,
        privacy: "private",
        madeForKids: guard.spec.madeForKids,
        disclosure: { altered: seo.disclosure.required, syntheticVoice: true },
        idempotencyKey: guard.spec.idempotencyKey,
        scheduledFor: new Date(scheduledIso),
      });
      videoId = up.videoId;
      await ctx.store.updateStage(ctx.run.id, stageKey, { checkpoint: { videoId } });
    }

    // ── not yet due: schedule and park ──
    const scheduledAt = new Date(scheduledIso);
    if (scheduledAt.getTime() > now.getTime() + 60_000) {
      if (!checkpoint.scheduled) {
        await ctx.youtube.setScheduled(videoId, scheduledAt);
        await ctx.store.updateStage(ctx.run.id, stageKey, { checkpoint: { scheduled: true } });
      }
      return {
        output: {
          videoId,
          privacyFirst: true,
          scheduledForIso: scheduledIso,
          spec: { title: guard.spec.title, tags: guard.spec.tags, madeForKids: guard.spec.madeForKids },
          quotaUsed: await ctx.youtube.quotaUsed(),
        },
        checkpoint: { videoId, scheduledForIso: scheduledIso, scheduled: true },
        hold: {
          kind: "timing",
          reason: `تم الرفع خاصاً (#${videoId}) وجُدول النشر عند ${scheduledIso} — بانتظار الموعد`,
          wakeAtIso: scheduledIso,
        },
      };
    }

    // ── due: verify status, then flip public explicitly ──
    let status = await ctx.youtube.videoStatus(videoId);
    if (status.state === "failed" || status.state === "rejected") {
      return {
        output: { videoId, status },
        retry: { reason: `حالة الفيديو على يوتيوب: ${status.state}` },
      };
    }
    if (status.privacy !== "public") {
      await ctx.youtube.setPublic(videoId);
      status = await ctx.youtube.videoStatus(videoId);
    }
    const publicUrl = status.publicUrl ?? `https://www.youtube.com/watch?v=${videoId}`;

    return {
      output: {
        videoId,
        publicUrl,
        privacyFirst: true,
        scheduledForIso: scheduledIso,
        status,
        spec: { title: guard.spec.title, tags: guard.spec.tags, madeForKids: guard.spec.madeForKids },
        quotaUsed: await ctx.youtube.quotaUsed(),
      },
      checkpoint: { videoId, scheduledForIso: scheduledIso, scheduled: true, publicUrl },
    };
  },

  async validate(_ctx, result): Promise<CheckOutcome[]> {
    const out = result.output as { videoId?: string; publicUrl?: string };
    const hasVideo = !!out.videoId;
    return [
      {
        key: "publish.video",
        pass: hasVideo && !!out.publicUrl,
        severity: "fail",
        message: hasVideo && out.publicUrl ? undefined : "لا يوجد معرّف/رابط فيديو بعد النشر",
      },
    ];
  },
});
