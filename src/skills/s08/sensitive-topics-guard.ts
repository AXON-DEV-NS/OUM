import { z } from "zod";
import { CONFIG } from "@/src/pipeline/config";
import { JudgeVerdictSchema } from "@/src/pipeline/schemas/qa";
import { defineSkill } from "@/src/skills/_types";
import { jsonPayload, rolePrompt, runJudge } from "@/src/skills/_common";

export const Input = z.strictObject({
  title: z.string().max(200),
  description: z.string().max(6000),
  scriptExcerpt: z.string().max(2000),
  writerFamily: z.string().min(2).max(20),
});

export const Output = z.strictObject({
  hits: z.array(z.string().max(120)).max(20),
  verdict: JudgeVerdictSchema,
  judgeFamily: z.string().max(20).optional(),
  judgeModel: z.string().max(120).optional(),
});

export const sensitiveTopicsGuard = defineSkill({
  key: "sensitive-topics-guard",
  version: "1.0.0",
  goal: "Two layer guard: deterministic keyword scan first (free), then an independent judge for policy-risky framing.",
  kind: "llm",
  path: "any",
  stages: ["S8"],
  judge: true,
  input: Input,
  output: Output,
  checklist: [
    "keyword hits fail the guard WITHOUT an llm call (fail cheap)",
    "no hits -> independent family judge (never the writer)",
    "judge score < 80 => pass=false with concrete fixes",
  ],
  examples: [
    { name: "keyword-hit", input: { title: "استثمار بدون مخاطرة يضمن لك الثراء", description: "طرق مضمونة للربح السريع بدون أي خطر أبداً في هذا المجال الواسع.", scriptExcerpt: "no risk money", writerFamily: "deepseek" }, expectOutput: { verdict: { pass: false } } },
  ],
  implemented: true,
  async run(rt, input) {
    const haystack = `${input.title}\n${input.description}\n${input.scriptExcerpt}`.toLowerCase();
    const hits = CONFIG.sensitiveKeywords.filter((k) => haystack.includes(k.toLowerCase()));
    if (hits.length > 0) {
      return {
        hits,
        verdict: {
          pass: false,
          score: 0,
          reasons: [`عبارات حساسة/وعود مضللة: ${hits.join("، ")}`],
          fixes: [
            { text: "احذف الوعود المطلقة أو المضللة من العنوان والوصف والنص", stage: "S3" },
            { text: "أعد صياغة العنوان والوصف بلغة واقعية بدون ضمانات", stage: "S7" },
          ],
        },
      };
    }
    const system = rolePrompt(
      "You are a YouTube policy and sensitivity reviewer. Judge whether the title/description/script framing is safe to publish: no misleading promises, " +
        "no medical/financial/legal advice presented as certainty, no hateful or polarizing framing, no dangerous challenges. " +
        "score 0-100 (>=80 safe). Give concrete fixes pointing at stage S3 (script) or S7 (title/description).",
      JudgeVerdictSchema,
    );
    const { data, judgeFamily, judgeModel } = await runJudge<z.infer<typeof JudgeVerdictSchema>>(rt, "sensitive-topics-guard", input.writerFamily, {
      system,
      user: `Review:\n${jsonPayload({ title: input.title, description: input.description, scriptExcerpt: input.scriptExcerpt })}`,
      schema: JudgeVerdictSchema,
      temperature: 0.2,
    });
    return { hits: [], verdict: data, judgeFamily, judgeModel };
  },
});
