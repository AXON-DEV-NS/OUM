import { z } from "zod";
import { EditListSchema, SubtitleCueSchema } from "@/src/pipeline/schemas/storyboard";
import { CONFIG } from "@/src/pipeline/config";
import { defineSkill } from "@/src/skills/_types";

export const Input = z.strictObject({
  scenes: z.array(z.strictObject({ id: z.string().max(40), seconds: z.number().min(1).max(300) })).min(1).max(200),
  voice: z.strictObject({ filePath: z.string().max(1024).nullable(), rateWpm: z.number().int().min(90).max(220) }),
  music: z.strictObject({ filePath: z.string().max(1024).nullable(), gainDb: z.number().max(0).min(-40) }).nullable(),
  format: z.strictObject({ vertical: z.boolean(), targetMinutes: z.number().min(0.5).max(60) }),
  assetsByScene: z.record(
    z.string(),
    z.strictObject({ filePath: z.string().max(1024).nullable(), source: z.enum(["image", "clip", "library"]) }),
  ),
  subtitles: z.array(SubtitleCueSchema).max(1000),
  transitions: z.record(z.string(), z.enum(["cut", "fade", "zoom"])).optional(),
});

export const Output = z.strictObject({ editList: EditListSchema });

export const editListBuilder = defineSkill({
  key: "edit-list-builder",
  version: "1.0.0",
  goal: "Pure-code assembly of the render timeline: sequential clips, dimensions, transitions, subtitles and loudness target.",
  kind: "code",
  path: "any",
  stages: ["S6"],
  input: Input,
  output: Output,
  checklist: [
    "clips are strictly sequential with no gaps or overlaps",
    "every scene appears exactly once with a valid source",
    "vertical format -> 1080x1920, horizontal -> 1920x1080",
    "loudness target pinned to the configured LUFS",
  ],
  examples: [
    {
      name: "two-clip-vertical",
      input: {
        scenes: [{ id: "s1", seconds: 5 }, { id: "s2", seconds: 7 }],
        voice: { filePath: null, rateWpm: 170 },
        music: null,
        format: { vertical: true, targetMinutes: 1 },
        assetsByScene: { s1: { filePath: null, source: "image" }, s2: { filePath: null, source: "image" } },
        subtitles: [],
      },
      expectOutput: {},
    },
  ],
  implemented: true,
  async run(_rt, input) {
    const start = 0;
    let cursor = start;
    const clips = input.scenes.map((scene, i) => {
      const asset = input.assetsByScene[scene.id];
      if (!asset) throw new Error(`no asset mapped for scene ${scene.id}`);
      const clip = {
        sceneId: scene.id,
        startSec: Math.round(cursor * 1000) / 1000,
        endSec: Math.round((cursor + scene.seconds) * 1000) / 1000,
        source: asset.source,
        filePath: asset.filePath,
        transition: input.transitions?.[scene.id] ?? (i === 0 ? "fade" : "cut"),
        onScreenText: null as string | null,
      };
      cursor += scene.seconds;
      return clip;
    });
    return {
      editList: {
        fps: 30,
        width: input.format.vertical ? 1080 : 1920,
        height: input.format.vertical ? 1920 : 1080,
        totalSeconds: Math.round(cursor * 1000) / 1000,
        clips,
        subtitles: input.subtitles,
        voice: { filePath: input.voice.filePath, rateWpm: input.voice.rateWpm },
        music: input.music,
        loudnessTargetLufs: CONFIG.lufs.target,
      },
    };
  },
});
