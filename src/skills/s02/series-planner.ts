import { z } from "zod";
import { IdeaSchema } from "@/src/pipeline/schemas/script";
import { defineSkill } from "@/src/skills/_types";
import { jsonPayload, llmJson, rolePrompt } from "@/src/skills/_common";

export const Input = z.strictObject({
  chosenIdea: IdeaSchema,
  niche: z.string().max(120),
  recentTitles: z.array(z.string().max(200)).max(50),
});

export const Output = z.strictObject({
  seriesName: z.string().max(120).nullable(),
  nextEpisodes: z.array(z.string().max(200)).max(5),
});

export const seriesPlanner = defineSkill({
  key: "series-planner",
  version: "1.0.0",
  goal: "Decide whether the chosen idea belongs to a series, and if so plan up to 5 next episodes for continuity.",
  kind: "llm",
  path: "any",
  stages: ["S2"],
  input: Input,
  output: Output,
  checklist: [
    "seriesName null when the idea is standalone",
    "episode titles are distinct from recent titles",
    "at most 5 next episodes",
  ],
  examples: [
    { name: "standalone", input: { chosenIdea: { title: "أفضل 5 هواتف 2026", angle: "قارن بين الفئات المتوسطة", targetAudience: "شباب" }, niche: "تقنية", recentTitles: [] } },
  ],
  implemented: true,
  async run(rt, input) {
    const system = rolePrompt(
      "You plan YouTube series. Be conservative: only name a series when the idea naturally extends to 3+ episodes. Otherwise seriesName=null and nextEpisodes=[]. " +
        "Episode titles must be follow-ups, not variations of the same episode.",
      Output,
    );
    return llmJson(rt, "series-planner", {
      system,
      user: `Plan the series:\n${jsonPayload(input)}`,
      schema: Output,
      temperature: 0.6,
    });
  },
});
