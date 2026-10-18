import { z } from "zod";
import { defineSkill } from "@/src/skills/_types";
import { jsonPayload, llmJson, rolePrompt } from "@/src/skills/_common";

export const Input = z.strictObject({
  referenceVideoUrl: z.string().max(2048),
  /** text evidence the operator provided (transcript excerpt / notes) */
  transcriptExcerpt: z.string().max(8000).optional(),
  userNotes: z.string().max(4000).optional(),
});

export const Output = z.strictObject({
  analyzed: z.boolean(),
  structure: z
    .array(z.strictObject({ name: z.string().max(80), purposePct: z.number().min(1).max(60) }))
    .max(8),
  hookStyle: z.string().max(400),
  pacingNotes: z.string().max(600),
  takeaways: z.array(z.string().max(300)).max(6),
});

export const referenceDecomposer = defineSkill({
  key: "reference-decomposer",
  version: "1.0.0",
  goal: "Decompose a reference video's structure — strictly from operator-provided text evidence, never from guesses.",
  kind: "llm",
  path: "any",
  stages: ["S0"],
  input: Input,
  output: Output,
  checklist: [
    "without transcript/notes it returns analyzed=false and makes NO llm call",
    "structure percentages stay within 1-60 per beat",
    "every takeaway references the provided evidence",
  ],
  examples: [
    {
      name: "no-evidence-honest-degrade",
      input: { referenceVideoUrl: "https://www.youtube.com/watch?v=abc123" },
      expectOutput: { analyzed: false },
    },
    {
      name: "with-notes",
      input: {
        referenceVideoUrl: "https://www.youtube.com/watch?v=abc123",
        userNotes: "الفيديو يبدأ بسؤال صادم، ثم 3 قصص قصيرة، نهاية بسيطة بدون CTA.",
      },
    },
  ],
  implemented: true,
  async run(rt, input) {
    if (!input.transcriptExcerpt && !input.userNotes) {
      return {
        analyzed: false,
        structure: [],
        hookStyle: "",
        pacingNotes: "",
        takeaways: ["لا يمكن تحليل الفيديو المرجعي بدون نص أو ملاحظات — أضف مقتطف نص أو ملاحظات المشغّل."],
      };
    }
    const system = rolePrompt(
      "You decompose the structure of a reference YouTube video from the text evidence provided (transcript excerpt and/or operator notes). " +
        "purposePct = percent of total runtime per beat. Never claim anything not supported by the evidence.",
      Output,
    );
    return llmJson(rt, "reference-decomposer", {
      system,
      user: `Reference evidence:\n${jsonPayload(input)}`,
      schema: Output,
      temperature: 0.3,
    });
  },
});
