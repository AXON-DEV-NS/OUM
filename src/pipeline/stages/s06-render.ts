/**
 * S6 — Render & QA1: voice synthesis -> subtitles -> deterministic edit list
 * -> render -> media probes (ffprobe when available). Resume-safe via
 * checkpoint file paths. Video-tier money only flows when this stage runs.
 */
import { z } from "zod";
import { validationFailed } from "../errors";
import { EditListSchema, type StoryboardPackage } from "../schemas/storyboard";
import { runChecks, type CheckOutcome } from "../checks";
import { checkAudioStream, checkLoudness, checkMediaPresent, checkVideoDuration, checkVideoResolution, measureLoudness, probeMedia } from "../checks/media";
import { dnaJson, outputOf } from "./_helpers";
import { defineStage, runStageSkill, type StageResult } from "../stage";
import type { editListBuilder } from "@/src/skills/s06/edit-list-builder";
import type { paceDoctor } from "@/src/skills/s06/pace-doctor";
import type { arabicSubtitleFormatter } from "@/src/skills/s06/arabic-subtitle-formatter";
import type { loudnessTuner } from "@/src/skills/s06/loudness-tuner";
import type { ScriptPackage } from "../schemas/script";

export const s06Render = defineStage({
  key: "S6",
  index: 6,
  title: "Render & QA1",
  costTier: "video",
  maxAttempts: 2,
  skills: ["edit-list-builder", "pace-doctor", "arabic-subtitle-formatter", "loudness-tuner"],

  async gate(ctx) {
    const storyboard = ctx.inputs.of("S4");
    const assets = ctx.inputs.of("S5");
    if (!storyboard) return { pass: false, code: "GATE_BLOCKED", reason: "لا يوجد ستوري بورد" };
    if (!assets) return { pass: false, code: "GATE_BLOCKED", reason: "لا توجد أصول مولّدة" };
    return { pass: true };
  },

  async execute(ctx): Promise<StageResult> {
    const dna = dnaJson(ctx);
    const storyboard = outputOf<StoryboardPackage & { totalSeconds?: number }>(ctx, "S4");
    const scriptPkg = outputOf<ScriptPackage>(ctx, "S3");
    const assetOut = outputOf<{ assets: Array<{ sceneId: string; filePath: string }> }>(ctx, "S5");
    const checkpoint = ctx.stageRow.checkpoint as { voiceFile?: string; renderFile?: string };

    const assetsByScene: Record<string, { filePath: string | null; source: "image" | "clip" | "library" }> = {};
    for (const a of assetOut.assets) assetsByScene[a.sceneId] = { filePath: a.filePath, source: "image" };

    // ── voice (resume-safe) ──
    let voiceFile = checkpoint.voiceFile ?? null;
    if (!voiceFile) {
      const tts = await ctx.media.synthesizeVoice({
        text: scriptPkg.script,
        style: storyboard.voice.style,
        rateWpm: storyboard.voice.rateWpm,
        purpose: "voice",
      });
      voiceFile = tts.filePath;
      await ctx.store.addAsset({
        runId: ctx.run.id,
        kind: "audio",
        stage: "S6",
        filePath: tts.filePath,
        mimeType: tts.mimeType,
        bytes: tts.bytes,
        width: null,
        height: null,
        durationSec: tts.durationSec ?? null,
        source: "generated",
        provider: tts.provider,
        license: "generated",
        licenseUrl: null,
        meta: { purpose: "narration" },
      });
      if (tts.costCents > 0) await ctx.spend({ provider: tts.provider, operation: "tts", costCents: tts.costCents, units: { chars: scriptPkg.script.length } });
    }

    // ── subtitles ──
    const subOut = (await runStageSkill(ctx, "arabic-subtitle-formatter", {
      scenes: storyboard.scenes.map((s) => ({ id: s.id, narration: s.narration, seconds: s.seconds })),
    })) as z.infer<typeof arabicSubtitleFormatter.output>;

    // ── edit list ──
    const editOut = (await runStageSkill(ctx, "edit-list-builder", {
      scenes: storyboard.scenes.map((s) => ({ id: s.id, seconds: s.seconds })),
      voice: { filePath: voiceFile, rateWpm: storyboard.voice.rateWpm },
      music: storyboard.music && dna.mode.format.targetMinutes > 0 ? { filePath: null, gainDb: -18 } : null,
      format: { vertical: dna.mode.format.vertical, targetMinutes: dna.mode.format.targetMinutes },
      assetsByScene,
      subtitles: subOut.cues,
    })) as z.infer<typeof editListBuilder.output>;

    // ── pace doctor (advisory in wave 1) ──
    const pace = (await runStageSkill(ctx, "pace-doctor", {
      clips: storyboard.scenes.map((s) => ({
        sceneId: s.id,
        seconds: s.seconds,
        narrationChars: s.narration.length,
      })),
      targetMinutes: dna.mode.format.targetMinutes,
    })) as z.infer<typeof paceDoctor.output>;

    // ── render (resume-safe) ──
    let renderFile = checkpoint.renderFile ?? null;
    let renderDuration = editOut.editList.totalSeconds;
    if (!renderFile) {
      const rendered = await ctx.media.render({ editList: editOut.editList, purpose: "render" });
      renderFile = rendered.filePath;
      renderDuration = rendered.durationSec ?? editOut.editList.totalSeconds;
      await ctx.store.addAsset({
        runId: ctx.run.id,
        kind: "video",
        stage: "S6",
        filePath: rendered.filePath,
        mimeType: rendered.mimeType,
        bytes: rendered.bytes,
        width: rendered.width ?? editOut.editList.width,
        height: rendered.height ?? editOut.editList.height,
        durationSec: renderDuration,
        source: "generated",
        provider: rendered.provider,
        license: "generated",
        licenseUrl: null,
        meta: { editList: true },
      });
      if (rendered.costCents > 0) await ctx.spend({ provider: rendered.provider, operation: "render", costCents: rendered.costCents, units: { seconds: renderDuration } });
    }

    // ── QA1 probes ──
    const probe = probeMedia(renderFile);
    const loudness = measureLoudness(renderFile);
    const loudnessTuned = (await runStageSkill(ctx, "loudness-tuner", {
      targetLufs: editOut.editList.loudnessTargetLufs,
      measurement: loudness.available && loudness.lufs !== undefined ? { available: true, lufs: loudness.lufs } : null,
    })) as z.infer<typeof loudnessTuner.output>;

    const qa1 = await runChecks(
      [checkMediaPresent, checkVideoResolution, checkVideoDuration, checkAudioStream, checkLoudness],
      {
        filePath: renderFile,
        probe,
        expectedSec: editOut.editList.totalSeconds,
        lufs: loudness.available ? loudness.lufs ?? null : null,
      },
    );

    const parsed = EditListSchema.safeParse(editOut.editList);
    if (!parsed.success) throw validationFailed("edit list invalid", parsed.error.issues.slice(0, 5));

    return {
      output: {
        editList: parsed.data,
        voice: { filePath: voiceFile, rateWpm: storyboard.voice.rateWpm },
        render: { filePath: renderFile, durationSec: renderDuration, width: parsed.data.width, height: parsed.data.height },
        subtitlesCount: subOut.cues.length,
        pace,
        loudness: loudnessTuned,
        qa1: qa1.outcomes,
        probe: { available: probe.available, reason: probe.reason },
      },
      score: qa1.score,
      checkpoint: { voiceFile, renderFile, qa1Score: qa1.score },
    };
  },

  async validate(_ctx, result): Promise<CheckOutcome[]> {
    const out = result.output as { editList?: unknown; qa1?: CheckOutcome[] };
    const parsed = EditListSchema.safeParse(out.editList);
    const issues: CheckOutcome[] = [];
    if (!parsed.success) {
      issues.push({ key: "render.editlist", pass: false, severity: "fail", message: `قائمة المونتاج غير صالحة: ${parsed.error.issues[0]?.message}` });
    }
    for (const o of out.qa1 ?? []) {
      if (o.severity === "fail" && !o.pass) issues.push(o);
    }
    return issues;
  },
});
