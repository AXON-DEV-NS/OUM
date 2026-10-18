import { z } from "zod";
import { CompetitorSchema } from "@/src/pipeline/schemas/dna";
import { defineSkill } from "@/src/skills/_types";
import { jsonPayload, llmJson, rolePrompt } from "@/src/skills/_common";

export const Input = z.strictObject({
  channelTitle: z.string().min(1).max(200),
  niche: z.string().max(120).optional(),
  markets: z.array(z.string().max(12)).min(1).max(10),
  /** competitor URLs the client supplied (analyze mode) */
  urls: z.array(z.string().max(2048)).max(5),
  /** operator notes about the competitors (honest substitute for crawling) */
  notes: z.string().max(6000).optional(),
  mode: z.enum(["analyze", "suggest"]),
});

export const Output = z.strictObject({
  competitors: z.array(CompetitorSchema).max(5),
  suggestions: z
    .array(z.strictObject({ name: z.string().max(120), why: z.string().max(300), searchQuery: z.string().max(120) }))
    .max(4),
});

export const competitorAnalyzer = defineSkill({
  key: "competitor-analyzer",
  version: "1.0.0",
  goal: "Map the competitive landscape: analyze supplied competitor evidence, or propose candidates to review (never invented URLs).",
  kind: "llm",
  path: "any",
  stages: ["S0"],
  input: Input,
  output: Output,
  checklist: [
    "analyze mode requires urls or notes; otherwise it degrades to suggestions",
    "suggestions never contain URLs (search queries only) — no hallucinated links",
    "strengths and weaknesses cite the provided evidence",
  ],
  examples: [
    {
      name: "suggest-mode",
      input: { channelTitle: "تقنية بالعربي", markets: ["eg"], urls: [], mode: "suggest" },
    },
  ],
  implemented: true,
  async run(rt, input) {
    const system = rolePrompt(
      "You are a YouTube competitive analyst. If real URLs and/or operator notes are given, summarize observable strengths/weaknesses ONLY from that evidence — " +
        "never invent facts about a channel you cannot see. In suggest mode, propose realistic candidate channels to review for the given niche/markets; " +
        "put a YouTube search query in searchQuery and NEVER fabricate a URL.",
      Output,
    );
    return llmJson(rt, "competitor-analyzer", {
      system,
      user: `Analyze for this channel:\n${jsonPayload(input)}`,
      schema: Output,
      temperature: 0.4,
    });
  },
});
