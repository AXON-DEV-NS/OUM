/**
 * S4 — Storyboard & voice: scenes from the script, voice direction, licensed
 * music pick. Avatar paths park here in wave 1 (sample shot + fingerprint
 * guard are wave 2) — faceless runs proceed.
 */
import { z } from "zod";
import { providerMissing, validationFailed } from "../errors";
import { StoryboardPackageSchema } from "../schemas/storyboard";
import { CheckOutcome } from "../checks";
import { dnaJson, outputOf } from "./_helpers";
import { defineStage, runStageSkill, type StageResult } from "../stage";
import type { sceneDirector } from "@/src/skills/s04/scene-director";
import type { voiceDirector } from "@/src/skills/s04/voice-director";
import type { licensedMusicPicker } from "@/src/skills/s04/licensed-music-picker";
import type { ScriptPackage } from "../schemas/script";

export const STORYBOARD_TOLERANCE = 0.25;

export const s04Storyboard = defineStage({
  key: "S4",
  index: 4,
  title: "Storyboard & voice",
  costTier: "text",
  maxAttempts: 3,
  skills: ["scene-director", "avatar-fingerprint-guard", "voice-director", "licensed-music-picker"],

  async gate(ctx) {
    if (ctx.usesAvatar()) {
      return {
        pass: false,
        code: "PROVIDER_MISSING",
        reason: "مسار الأفاتار (اللقطة التجريبية + حارس البصمة) ضمن الموجة الثانية — المسار المدعوم حالياً Faceless",
      };
    }
    return { pass: true };
  },

  async execute(ctx): Promise<StageResult> {
    const dna = dnaJson(ctx);
    const scriptPkg = outputOf<ScriptPackage>(ctx, "S3");
    const families = await ctx.llm.families();
    if (families.length === 0) throw providerMissing("LLM required for storyboard");
    const targetMinutes = dna.mode.format.targetMinutes;

    const directed = (await runStageSkill(ctx, "scene-director", {
      script: scriptPkg.script,
      structure: scriptPkg.structure.map((b) => ({ name: b.name, seconds: b.seconds })),
      targetMinutes,
      usesAvatar: ctx.usesAvatar(),
      markets: dna.audience.markets,
    })) as z.infer<typeof sceneDirector.output>;

    const voice = (await runStageSkill(ctx, "voice-director", {
      scenes: directed.scenes.map((s) => ({ id: s.id, narration: s.narration })),
      markets: dna.audience.markets,
      tone: dna.mode.voiceStyle,
    })) as z.infer<typeof voiceDirector.output>;

    const music = (await runStageSkill(ctx, "licensed-music-picker", {
      wantMusic: true,
      mood: directed.scenes[0]?.mood,
    })) as z.infer<typeof licensedMusicPicker.output>;

    const pack = {
      scenes: directed.scenes,
      voice: voice.voice,
      music: music.music,
      onScreenText: directed.onScreenText,
    };
    const parsed = StoryboardPackageSchema.safeParse(pack);
    if (!parsed.success) throw validationFailed("storyboard package invalid", parsed.error.issues.slice(0, 5));

    const totalSeconds = parsed.data.scenes.reduce((s, x) => s + x.seconds, 0);
    return {
      output: { ...parsed.data, totalSeconds, musicNote: music.note },
      checkpoint: { scenesCount: parsed.data.scenes.length, totalSeconds },
    };
  },

  async validate(ctx, result): Promise<CheckOutcome[]> {
    const out = result.output as z.infer<typeof StoryboardPackageSchema> & { totalSeconds?: number };
    const issues: CheckOutcome[] = [];
    const parsed = StoryboardPackageSchema.safeParse({
      scenes: out.scenes,
      voice: out.voice,
      music: out.music,
      onScreenText: out.onScreenText,
    });
    if (!parsed.success) {
      return [{ key: "storyboard.schema", pass: false, severity: "fail", message: `حزمة الستوري بورد غير صالحة: ${parsed.error.issues[0]?.message}` }];
    }
    const total = parsed.data.scenes.reduce((s, x) => s + x.seconds, 0);
    let target = 180;
    try {
      target = dnaJson(ctx).mode.format.targetMinutes * 60;
    } catch {
      // DNA missing — schema check above already gates
    }
    const drift = Math.abs(total - target) / target;
    issues.push({
      key: "storyboard.duration",
      pass: drift <= STORYBOARD_TOLERANCE,
      severity: "fail",
      message: drift <= STORYBOARD_TOLERANCE ? undefined : `مجموع المشاهد ${Math.round(total)}ث مقابل هدف ${Math.round(target)}ث (±${Math.round(drift * 100)}%)`,
      fix: "أعد توزيع ثواني المشاهد لتقترب من المدة المستهدفة",
      fixStage: "S4",
    });
    if (!ctx.usesAvatar()) {
      const avatarScenes = parsed.data.scenes.filter((s) => s.requiresAvatar);
      issues.push({
        key: "storyboard.faceless",
        pass: avatarScenes.length === 0,
        severity: "fail",
        message: avatarScenes.length ? `${avatarScenes.length} مشهد يتطلب أفاتار في مسار Faceless` : undefined,
        fix: "اجعل requiresAvatar=false لكل المشاهد",
        fixStage: "S4",
      });
    }
    const ids = parsed.data.scenes.map((s) => s.id);
    const unique = new Set(ids);
    issues.push({ key: "storyboard.ids", pass: unique.size === ids.length, severity: "fail", message: unique.size === ids.length ? undefined : "معرفات مشاهد مكررة", fixStage: "S4" });
    return issues;
  },
});
