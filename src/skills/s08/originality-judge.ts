import { z } from "zod";
import { JudgeVerdictSchema } from "@/src/pipeline/schemas/qa";
import { defineSkill } from "@/src/skills/_types";
import { jsonPayload, rolePrompt, runJudge } from "@/src/skills/_common";

export const Input = z.strictObject({
  title: z.string().min(8).max(140),
  scriptExcerpt: z.string().min(50).max(2000),
  archiveTitles: z.array(z.string().max(300)).max(200),
  writerFamily: z.string().min(2).max(20),
});

export const Output = z.strictObject({
  verdict: JudgeVerdictSchema,
  judgeFamily: z.string().min(2).max(20),
  judgeModel: z.string().min(2).max(120),
});

export const originalityJudge = defineSkill({
  key: "originality-judge",
  version: "1.0.0",
  goal: "Independent originality audit versus the channel archive: flags rehashed angles and generic filler phrasing.",
  kind: "llm",
  path: "any",
  stages: ["S8"],
  judge: true,
  input: Input,
  output: Output,
  checklist: [
    "judge family differs from the writer family",
    "archive titles are treated as covered ground",
    "score < 80 when the angle is a rehash of an archive title",
    "fixes point at S3 (new angle) or S7 (reframed title)",
  ],
  examples: [
    {
      name: "fresh-angle",
      input: { title: "لماذا تسخن بطارية هاتفك؟", scriptExcerpt: "شرح علمي مبسط لأسباب الحرارة الداخلية للبطارية وطرق الوقاية العملية.".padEnd(60, " "), archiveTitles: ["أفضل 5 هواتف 2026"], writerFamily: "deepseek" },
    },
  ],
  implemented: true,
  async run(rt, input) {
    const system = rolePrompt(
      "You audit YouTube originality. Compare the script's angle against the archive titles. " +
        "Penalize: essentially the same video as an archive title, generic AI filler phrasing with no specific insight. " +
        "score >= 80 means genuinely fresh. fixes point at S3 (script angle) or S7 (reframe title).",
      JudgeVerdictSchema,
    );
    const { data, judgeFamily, judgeModel } = await runJudge<z.infer<typeof JudgeVerdictSchema>>(rt, "originality-judge", input.writerFamily, {
      system,
      user: `Audit originality:\n${jsonPayload({ title: input.title, scriptExcerpt: input.scriptExcerpt, archiveTitles: input.archiveTitles })}`,
      schema: JudgeVerdictSchema,
      temperature: 0.2,
    });
    return { verdict: data, judgeFamily, judgeModel };
  },
});
