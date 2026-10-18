import { z } from "zod";
import { MUSIC_LIBRARY, pickTrack } from "@/src/pipeline/library/manifest";
import { defineSkill } from "@/src/skills/_types";

export const Input = z.strictObject({
  wantMusic: z.boolean(),
  mood: z.string().max(120).optional(),
});

export const Output = z.strictObject({
  music: z.strictObject({ trackId: z.string().max(60), title: z.string().max(200), license: z.string().max(120) }).nullable(),
  poolSize: z.number().int().min(0),
  note: z.string().max(300),
});

export const licensedMusicPicker = defineSkill({
  key: "licensed-music-picker",
  version: "1.0.0",
  goal: "Pick background music ONLY from the in-repo licensed library; empty library means no music — never an unlicensed track.",
  kind: "code",
  path: "any",
  stages: ["S4"],
  input: Input,
  output: Output,
  checklist: [
    "selection comes exclusively from MUSIC_LIBRARY",
    "an empty library returns music=null with an explanatory note",
    "the track carries its license string forward",
  ],
  examples: [
    { name: "empty-library", input: { wantMusic: true, mood: "energetic" }, expectOutput: { music: null, poolSize: 0 } },
    { name: "no-music-requested", input: { wantMusic: false }, expectOutput: { music: null } },
  ],
  implemented: true,
  async run(_rt, input) {
    if (!input.wantMusic) return { music: null, poolSize: MUSIC_LIBRARY.length, note: "الموسيقى غير مطلوبة لهذا المسار" };
    const track = pickTrack(input.mood);
    if (!track) {
      return {
        music: null,
        poolSize: MUSIC_LIBRARY.length,
        note: "مكتبة الموسيقى المرخصة فارغة — شغّل الفيديو بدون موسيقى أو أضف مقاطع مرخصة إلى src/pipeline/library",
      };
    }
    return {
      music: { trackId: track.id, title: track.title, license: track.license },
      poolSize: MUSIC_LIBRARY.length,
      note: `اختيار من المكتبة المرخصة (${track.license})`,
    };
  },
});
