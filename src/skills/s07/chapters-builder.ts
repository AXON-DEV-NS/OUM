import { z } from "zod";
import { defineSkill } from "@/src/skills/_types";

export const Input = z.strictObject({
  scenes: z
    .array(z.strictObject({ id: z.string().max(40), seconds: z.number().min(1).max(300), label: z.string().min(1).max(120) }))
    .min(1)
    .max(200),
  /** localized fallback label for the first chapter */
  introLabel: z.string().min(1).max(120),
  minGapSec: z.number().min(5).max(60).default(15),
});

export const Output = z.strictObject({
  chapters: z.array(z.strictObject({ at: z.string().regex(/^\d{1,2}:\d{2}(:\d{2})?$/), label: z.string().min(1).max(120) })).max(40),
  skipped: z.boolean(),
  reason: z.string().max(300).optional(),
});

function stamp(sec: number): string {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(ss).padStart(2, "0")}`;
}

export const chaptersBuilder = defineSkill({
  key: "chapters-builder",
  version: "1.0.0",
  goal: "Build YouTube chapters from scene boundaries: first at 0:00, at least 10s apart, minimum 3 chapters — otherwise skip them.",
  kind: "code",
  path: "any",
  stages: ["S7"],
  input: Input,
  output: Output,
  checklist: [
    "first chapter exactly 0:00",
    "all gaps >= 10 seconds",
    "fewer than 3 usable chapters -> skipped=true, empty list (YouTube requires 3)",
    "labels come from scene labels",
  ],
  examples: [
    {
      name: "three-chapter-ok",
      input: { scenes: [{ id: "s1", seconds: 20, label: "مقدمة" }, { id: "s2", seconds: 20, label: "أسباب" }, { id: "s3", seconds: 20, label: "حل" }, { id: "s4", seconds: 20, label: "خاتمة" }], introLabel: "البداية" },
      expectOutput: { skipped: false },
    },
    {
      name: "too-short-video",
      input: { scenes: [{ id: "s1", seconds: 30, label: "كل شيء" }], introLabel: "البداية" },
      expectOutput: { skipped: true },
    },
  ],
  implemented: true,
  async run(_rt, input) {
    const total = input.scenes.reduce((s, x) => s + x.seconds, 0);
    if (total < 60) return { chapters: [], skipped: true, reason: "الفيديو أقصر من دقيقة — يوتيوب لا يدعم الفصول" };

    const chapters: Array<{ at: string; label: string }> = [{ at: "0:00", label: input.introLabel }];
    let cursor = 0;
    let sinceLast = 0;
    input.scenes.forEach((scene, i) => {
      cursor += scene.seconds;
      sinceLast += scene.seconds;
      const remaining = total - cursor;
      const isLast = i === input.scenes.length - 1;
      if (!isLast && sinceLast >= input.minGapSec && remaining >= 10) {
        chapters.push({ at: stamp(cursor), label: scene.label });
        sinceLast = 0;
      }
    });
    if (chapters.length < 3) {
      return { chapters: [], skipped: true, reason: "أقل من 3 فصول قابلة للاستخدام — تم تخطي الفصول" };
    }
    return { chapters, skipped: false };
  },
});
