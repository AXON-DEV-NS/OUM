import { z } from "zod";
import { defineSkill } from "@/src/skills/_types";
import { jsonPayload, llmJson, rolePrompt } from "@/src/skills/_common";

export const Input = z.strictObject({
  channelTitle: z.string().max(200),
  periodDays: z.number().int().min(1).max(31),
  runs: z
    .array(z.strictObject({ title: z.string().max(140), score: z.number().int().min(0).max(100).nullable(), status: z.string().max(20) }))
    .max(100),
  lessons: z.array(z.string().max(240)).max(50),
  spendCents: z.number().int().min(0),
});

export const Output = z.strictObject({
  subject: z.string().min(5).max(200),
  bodyMarkdown: z.string().min(50).max(4000),
});

export const weeklyReportWriter = defineSkill({
  key: "weekly-report-writer",
  version: "1.0.0",
  goal: "Write the weekly owner report: what shipped, QA scores, spend, lessons and next-week suggestions — strictly from the data.",
  kind: "llm",
  path: "any",
  stages: ["S12"],
  input: Input,
  output: Output,
  checklist: [
    "every claim in the report matches the input data",
    "spend stated in cents exactly as given",
    "next-step suggestions are concrete, max 3",
  ],
  examples: [
    {
      name: "two-runs",
      input: {
        channelTitle: "تقنية بالعربي",
        periodDays: 7,
        runs: [{ title: "لماذا تسخن البطاريات؟", score: 91, status: "DONE" }, { title: "أفضل شواحن 2026", score: 76, status: "HOLD" }],
        lessons: ["عناوين أقل من 60 حرفاً ترفع الاكتمال"],
        spendCents: 480,
      },
    },
  ],
  implemented: true,
  async run(rt, input) {
    const system = rolePrompt(
      "You write a concise weekly YouTube production report in the channel's language. Sections: ما تم إنتاجه، الجودة، التكلفة، الدروس، اقتراحات الأسبوع القادم (≤3). " +
        "Use ONLY the provided data. Never invent analytics (views/CTR) that are not in the input.",
      Output,
    );
    return llmJson(rt, "weekly-report-writer", {
      system,
      user: `Write the report:\n${jsonPayload(input)}`,
      schema: Output,
      temperature: 0.5,
    });
  },
});
