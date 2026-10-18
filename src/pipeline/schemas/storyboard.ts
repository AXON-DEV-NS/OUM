/**
 * Storyboard + asset-plan + edit-list contracts (stages S4–S6).
 */
import { z } from "zod";

export const SceneSchema = z.strictObject({
  id: z.string().min(1).max(40),
  index: z.number().int().min(0).max(200),
  narration: z.string().min(5).max(1200),
  seconds: z.number().min(1).max(300),
  shotType: z.enum(["talking_head", "broll", "screen", "text_card", "montage"]),
  visualPrompt: z.string().min(10).max(1200),
  mood: z.string().max(120).optional(),
  requiresAvatar: z.boolean(),
});

export const StoryboardPackageSchema = z.strictObject({
  scenes: z.array(SceneSchema).min(4).max(80),
  voice: z.strictObject({
    style: z.string().min(3).max(300),
    rateWpm: z.number().int().min(90).max(220),
    emphasisNotes: z.array(z.string().max(200)).max(40),
  }),
  music: z
    .strictObject({ trackId: z.string().nullable(), title: z.string().nullable(), license: z.string().nullable(), mood: z.string().max(120).optional() })
    .nullable(),
  onScreenText: z.array(z.string().max(120)).max(60),
});

export type Scene = z.infer<typeof SceneSchema>;
export type StoryboardPackage = z.infer<typeof StoryboardPackageSchema>;

export const AssetPlanSchema = z.strictObject({
  items: z.array(
    z.strictObject({
      sceneId: z.string().min(1),
      kind: z.enum(["image", "clip"]),
      prompt: z.string().min(10).max(1500),
      /** "generate" | "library" — library needs license metadata */
      source: z.enum(["generate", "library"]),
      libraryId: z.string().nullable(),
      license: z.string().nullable(),
      licenseUrl: z.string().nullable(),
      estimatedCents: z.number().int().min(0),
    }),
  ).min(1).max(120),
  estimatedTotalCents: z.number().int().min(0),
});

export type AssetPlan = z.infer<typeof AssetPlanSchema>;

export const SubtitleCueSchema = z.strictObject({
  startSec: z.number().min(0),
  endSec: z.number().min(0.5),
  text: z.string().min(1).max(240),
});

export const EditListSchema = z.strictObject({
  fps: z.number().int().min(24).max(60),
  width: z.number().int().min(720),
  height: z.number().int().min(720),
  totalSeconds: z.number().min(5),
  clips: z.array(
    z.strictObject({
      sceneId: z.string().min(1),
      startSec: z.number().min(0),
      endSec: z.number().min(0.5),
      source: z.enum(["image", "clip", "library"]),
      filePath: z.string().nullable(),
      transition: z.enum(["cut", "fade", "zoom"]),
      onScreenText: z.string().max(120).nullable(),
    }),
  ).min(1).max(200),
  subtitles: z.array(SubtitleCueSchema).max(1000),
  voice: z.strictObject({ filePath: z.string().nullable(), rateWpm: z.number().int().min(90).max(220) }),
  music: z.strictObject({ filePath: z.string().nullable(), gainDb: z.number().max(0).min(-40) }).nullable(),
  loudnessTargetLufs: z.number().max(-5).min(-30),
});

export type EditList = z.infer<typeof EditListSchema>;
export type SubtitleCue = z.infer<typeof SubtitleCueSchema>;
