import { z } from "zod";
import { AudienceSchema } from "@/src/pipeline/schemas/dna";
import { defineSkill } from "@/src/skills/_types";
import { jsonPayload, llmJson, rolePrompt } from "@/src/skills/_common";

export const Input = z.strictObject({
  channelTitle: z.string().min(1).max(200),
  niche: z.string().max(120).optional(),
  markets: z.array(z.string().max(12)).min(1).max(10),
  languages: z.array(z.string().max(12)).min(1).max(10),
  tone: z.string().max(200).optional(),
});

export const Output = z.strictObject({ audience: AudienceSchema });

export const audienceEmbedder = defineSkill({
  key: "audience-embedder",
  version: "1.0.0",
  goal: "Build a compact audience model (markets, pains, desires) that every later stage uses as context.",
  kind: "llm",
  path: "any",
  stages: ["S0"],
  input: Input,
  output: Output,
  checklist: [
    "summary is 20-600 chars, written in the content language",
    "markets/languages non-empty and consistent with the channel profile",
    "at most 8 pains and 8 desires, concrete not generic",
  ],
  examples: [
    { name: "arabic-tech", input: { channelTitle: "تقنية بالعربي", markets: ["eg", "sa"], languages: ["ar"], tone: "ودي" } },
  ],
  implemented: true,
  async run(rt, input) {
    const system = rolePrompt(
      "You model the audience of a YouTube channel. Be concrete: pains and desires must be specific, observable behaviors — not marketing fluff. " +
        "Write summary in the channel's primary language.",
      Output,
    );
    return llmJson(rt, "audience-embedder", {
      system,
      user: `Channel profile:\n${jsonPayload(input)}`,
      schema: Output,
      temperature: 0.4,
    });
  },
});
