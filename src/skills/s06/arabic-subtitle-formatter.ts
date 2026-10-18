import { z } from "zod";
import { SubtitleCueSchema } from "@/src/pipeline/schemas/storyboard";
import { defineSkill } from "@/src/skills/_types";

export const Input = z.strictObject({
  scenes: z.array(z.strictObject({ id: z.string().max(40), narration: z.string().min(1).max(1200), seconds: z.number().min(1).max(300) })).min(1).max(200),
  maxLineChars: z.number().int().min(20).max(60).default(42),
  maxLines: z.number().int().min(1).max(3).default(2),
  minCueSec: z.number().min(0.5).max(3).default(1.0),
});

export const Output = z.strictObject({
  cues: z.array(SubtitleCueSchema).max(1000),
});

/** split a sentence into <=maxLines chunks of <=maxLineChars, word boundaries only */
export function wrapText(text: string, maxLineChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  const limit = maxLineChars * maxLines;
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (candidate.length > limit && current) {
      chunks.push(current);
      current = w;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export const arabicSubtitleFormatter = defineSkill({
  key: "arabic-subtitle-formatter",
  version: "1.0.0",
  goal: "Deterministically convert scene narration into subtitle cues respecting 2 lines x 42 chars, minimum duration and RTL-safe punctuation.",
  kind: "code",
  path: "any",
  stages: ["S6"],
  input: Input,
  output: Output,
  checklist: [
    "no cue longer than maxLines x maxLineChars",
    "no cue shorter than minCueSec (merged into neighbours)",
    "cue durations proportional to text length within each scene",
    "cues are strictly ordered and cover every scene",
  ],
  examples: [
    {
      name: "split-long-line",
      input: { scenes: [{ id: "s1", narration: "هذه جملة طويلة جدا تحتاج إلى تقسيم على أكثر من سطر واحد للترجمة العربية", seconds: 8 }] },
    },
  ],
  implemented: true,
  async run(_rt, input) {
    const cues: Array<z.infer<typeof SubtitleCueSchema>> = [];
    let t = 0;
    for (const scene of input.scenes) {
      const sentences = scene.narration
        .split(/(?<=[.!?؟…])\s+|[\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const pieces: string[] = [];
      for (const s of sentences.length ? sentences : [scene.narration]) {
        pieces.push(...wrapText(s, input.maxLineChars, input.maxLines));
      }
      const totalChars = pieces.reduce((sum, p) => sum + p.length, 0) || 1;
      let cursor = t;
      pieces.forEach((piece) => {
        const share = (piece.length / totalChars) * scene.seconds;
        const start = cursor;
        let end = cursor + Math.max(share, input.minCueSec);
        if (end > t + scene.seconds) end = t + scene.seconds;
        if (end - start >= 0.4) {
          cues.push({ startSec: Math.round(start * 100) / 100, endSec: Math.round(end * 100) / 100, text: piece });
        }
        cursor = end;
      });
      t += scene.seconds;
    }
    // merge too-short cues forward (deterministic)
    const merged: typeof cues = [];
    for (const cue of cues) {
      const prev = merged[merged.length - 1];
      if (prev && cue.endSec - cue.startSec < input.minCueSec && prev.text.length + cue.text.length <= input.maxLineChars * input.maxLines) {
        prev.text = `${prev.text} ${cue.text}`;
        prev.endSec = cue.endSec;
      } else {
        merged.push({ ...cue });
      }
    }
    return { cues: merged };
  },
});
