import { z } from "zod";
import { JudgeVerdictSchema } from "@/src/pipeline/schemas/qa";
import { defineSkill } from "@/src/skills/_types";
import { jsonPayload, rolePrompt, runJudge } from "@/src/skills/_common";

export const Input = z.strictObject({
  title: z.string().min(8).max(140),
  thumbnailText: z.string().min(2).max(60),
  scriptExcerpt: z.string().min(50).max(2000),
  writerFamily: z.string().min(2).max(20),
});

export const Output = z.strictObject({
  verdict: JudgeVerdictSchema,
  judgeFamily: z.string().min(2).max(20),
  judgeModel: z.string().min(2).max(120),
});

export const promiseMatchJudge = defineSkill({
  key: "promise-match-judge",
  version: "1.0.0",
  goal: "Independent check of the promise triple — title vs thumbnail vs first minute — nothing promised that the content does not deliver.",
  kind: "llm",
  path: "any",
  stages: ["S8"],
  judge: true,
  input: Input,
  output: Output,
  checklist: [
    "judge family differs from the writer family",
    "score < 80 whenever title/thumbnail promise exceeds the content",
    "fixes point at S7 (title/thumbnail) or S3 (script)",
  ],
  examples: [
    {
      name: "aligned",
      input: { title: "لماذا تسخن بطارية هاتفك؟", thumbnailText: "سبب مفاجئ", scriptExcerpt: "هاتفك بيسخن لسبب مش متوقع أغلب الناس بتفتكره غلط والسبب الحقيقي متعلق بطريقة الشحن ودرجة الحرارة.".padEnd(80, " "), writerFamily: "deepseek" },
    },
  ],
  implemented: true,
  async run(rt, input) {
    const system = rolePrompt(
      "You verify the promise triple of a YouTube video: (1) the title, (2) the thumbnail overlay text, (3) the first part of the script. " +
        "penalize: title promising X but script delivering Y, thumbnail text duplicating the title instead of adding, clickbait with no payoff. " +
        "score >= 80 means aligned and honest. reasons must quote the mismatch. fixes name the stage to redo (S7 title/thumb, S3 script).",
      JudgeVerdictSchema,
    );
    const { data, judgeFamily, judgeModel } = await runJudge<z.infer<typeof JudgeVerdictSchema>>(rt, "promise-match-judge", input.writerFamily, {
      system,
      user: `Judge the promise triple:\n${jsonPayload({ title: input.title, thumbnailText: input.thumbnailText, scriptExcerpt: input.scriptExcerpt })}`,
      schema: JudgeVerdictSchema,
      temperature: 0.2,
    });
    return { verdict: data, judgeFamily, judgeModel };
  },
});
