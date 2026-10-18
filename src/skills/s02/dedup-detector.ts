import { z } from "zod";
import { CONFIG } from "@/src/pipeline/config";
import { maxSimilarity } from "@/src/pipeline/checks/text";
import { defineSkill } from "@/src/skills/_types";

export const Input = z.strictObject({
  candidate: z.string().min(4).max(400),
  archive: z.array(z.string().max(300)).max(200),
});

export const Output = z.strictObject({
  duplicate: z.boolean(),
  maxScore: z.number().min(0).max(1),
  against: z.string().max(300).nullable(),
  threshold: z.number().min(0).max(1),
});

export const dedupDetector = defineSkill({
  key: "dedup-detector",
  version: "1.0.0",
  goal: "Deterministic duplicate detection of a candidate title against the channel archive (word-trigram Jaccard).",
  kind: "code",
  path: "any",
  stages: ["S2", "S3"],
  input: Input,
  output: Output,
  checklist: [
    "uses the configured duplicate threshold (default 0.72)",
    "an empty archive always passes",
    "returns the closest archive title as evidence",
  ],
  examples: [
    { name: "exact-rehash", input: { candidate: "أفضل 5 هواتف لعام 2026", archive: ["أفضل 5 هواتف لعام 2026"] }, expectOutput: { duplicate: true } },
    { name: "new-angle", input: { candidate: "لماذا بطاريات الهواتف تسخن؟", archive: ["أفضل 5 هواتف لعام 2026"] }, expectOutput: { duplicate: false } },
  ],
  implemented: true,
  async run(_rt, input) {
    const { score, against } = maxSimilarity(input.candidate, input.archive);
    return {
      duplicate: score >= CONFIG.similarity.duplicateThreshold,
      maxScore: Math.round(score * 1000) / 1000,
      against: against ?? null,
      threshold: CONFIG.similarity.duplicateThreshold,
    };
  },
});
