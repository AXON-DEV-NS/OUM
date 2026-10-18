/**
 * S5 — Assets: image-tier. Prompts are engineered, the cost is estimated and
 * guarded BEFORE generation, then each scene is generated with resume-safe
 * checkpoints (done sceneIds survive retries — no double spend).
 */
import { z } from "zod";
import { estimateImageCents } from "../guards/cost";
import { validationFailed } from "../errors";
import { CheckOutcome, fail, ok } from "../checks";
import { dnaJson, outputOf } from "./_helpers";
import { defineStage, runStageSkill, type StageResult } from "../stage";
import type { scenePromptEngineer } from "@/src/skills/s05/scene-prompt-engineer";
import type { StoryboardPackage } from "../schemas/storyboard";

export const s05Assets = defineStage({
  key: "S5",
  index: 5,
  title: "Assets",
  costTier: "image",
  maxAttempts: 3,
  skills: ["scene-prompt-engineer", "deformity-detector", "fallback-picker"],

  async gate(ctx) {
    if (!ctx.media.isConfigured()) {
      return { pass: false, code: "PROVIDER_MISSING", reason: ctx.media.reason() };
    }
    return { pass: true };
  },

  async execute(ctx): Promise<StageResult> {
    dnaJson(ctx);
    const storyboard = outputOf<StoryboardPackage>(ctx, "S4");
    const vertical = dnaJson(ctx).mode.format.vertical;
    const aspect: "16:9" | "9:16" = vertical ? "9:16" : "16:9";

    const engineered = (await runStageSkill(ctx, "scene-prompt-engineer", {
      scenes: storyboard.scenes.map((s) => ({ id: s.id, visualPrompt: s.visualPrompt, mood: s.mood })),
      styleHint: dnaJson(ctx).mode.voiceStyle,
      usesAvatar: ctx.usesAvatar(),
    })) as z.infer<typeof scenePromptEngineer.output>;

    const promptById = new Map(engineered.items.map((i) => [i.sceneId, i.prompt]));
    const missingPrompts = storyboard.scenes.filter((s) => !promptById.has(s.id));
    if (missingPrompts.length) throw validationFailed(`prompts missing for scenes: ${missingPrompts.map((s) => s.id).join(", ")}`);

    const estimate = estimateImageCents(storyboard.scenes.length);
    const spent = await ctx.store.ledgerTotal(ctx.run.id);
    if (spent + estimate > ctx.run.costCapCents) {
      return {
        output: { plan: { items: storyboard.scenes.length, estimatedCents: estimate } },
        hold: { kind: "budget", reason: `تقدير توليد الصور ${estimate}c + المنفق ${spent}c يتجاوز السقف ${ctx.run.costCapCents}c` },
      };
    }

    const doneIds = new Set(((ctx.stageRow.checkpoint.doneSceneIds as string[] | undefined) ?? []));
    const assets: Array<{ sceneId: string; filePath: string; width?: number; height?: number; bytes: number }> = [];
    let actualCents = 0;

    for (const scene of storyboard.scenes) {
      if (doneIds.has(scene.id)) {
        const existing = (await ctx.store.listAssets(ctx.run.id)).find(
          (a) => a.stage === "S5" && (a.meta as { sceneId?: string } | null)?.sceneId === scene.id,
        );
        if (existing?.filePath) {
          assets.push({ sceneId: scene.id, filePath: existing.filePath, width: existing.width ?? undefined, height: existing.height ?? undefined, bytes: existing.bytes ?? 0 });
          continue;
        }
      }
      const generated = await ctx.media.generateImage({ prompt: promptById.get(scene.id)!, aspect, purpose: `scene:${scene.id}` });
      await ctx.store.addAsset({
        runId: ctx.run.id,
        kind: "image",
        stage: "S5",
        filePath: generated.filePath,
        mimeType: generated.mimeType,
        bytes: generated.bytes,
        width: generated.width ?? null,
        height: generated.height ?? null,
        durationSec: null,
        source: "generated",
        provider: generated.provider,
        license: "generated",
        licenseUrl: null,
        meta: { sceneId: scene.id, prompt: promptById.get(scene.id) },
      });
      if (generated.costCents > 0) {
        await ctx.spend({ provider: generated.provider, operation: "image", costCents: generated.costCents, units: { sceneId: scene.id } });
        actualCents += generated.costCents;
      }
      doneIds.add(scene.id);
      assets.push({ sceneId: scene.id, filePath: generated.filePath, width: generated.width, height: generated.height, bytes: generated.bytes });
    }

    return {
      output: {
        plan: { items: storyboard.scenes.length, estimatedCents: estimate },
        assets,
        actualCents,
        deformityScan: "wave2 — الفحص البصري للتشوهات غير مفعّل بعد",
      },
      checkpoint: { doneSceneIds: [...doneIds] },
    };
  },

  async validate(_ctx, result): Promise<CheckOutcome[]> {
    const out = result.output as { assets?: Array<{ sceneId: string; filePath: string }>; plan?: { estimatedCents: number } };
    if (!out.assets?.length) return [fail("assets.present", "لا توجد أصول مولّدة")];
    const empty = out.assets.filter((a) => !a.filePath);
    if (empty.length) return [fail("assets.files", `${empty.length} مشهد بدون ملف مولّد`)];
    return [ok("assets.present", `${out.assets.length} أصل مولّد`)];
  },
});
