/**
 * S2 — Research & idea: trends -> scored ideas -> dedup vs archive ->
 * sensitive scan -> optional series plan. All LLM work is text-tier (cheap).
 */
import { z } from "zod";
import { CONFIG } from "../config";
import { providerMissing, validationFailed } from "../errors";
import { ResearchPackageSchema } from "../schemas/script";
import { runChecks } from "../checks";
import { dnaJson, isArabic, ruleLines } from "./_helpers";
import { defineStage, runStageSkill, type StageResult } from "../stage";
import type { trendScout } from "@/src/skills/s02/trend-scout";
import type { ideaScorer } from "@/src/skills/s02/idea-scorer";
import type { dedupDetector } from "@/src/skills/s02/dedup-detector";
import type { seriesPlanner } from "@/src/skills/s02/series-planner";

export const s02Research = defineStage({
  key: "S2",
  index: 2,
  title: "Research & idea",
  costTier: "text",
  maxAttempts: 3,
  skills: ["trend-scout", "idea-scorer", "dedup-detector", "series-planner"],

  async gate(ctx) {
    const families = await ctx.llm.families();
    if (families.length === 0) return { pass: false, code: "PROVIDER_MISSING", reason: "لا يوجد مزوّد نماذج مضبوط" };
    return { pass: true };
  },

  async execute(ctx): Promise<StageResult> {
    const dna = dnaJson(ctx);
    const families = await ctx.llm.families();
    if (families.length === 0) throw providerMissing("LLM required for research");
    const writerFamily = families[0];

    const archive = await ctx.store.listArchiveTitles(ctx.run.channelId, CONFIG.similarity.archiveTitles);

    const trends = (await runStageSkill(ctx, "trend-scout", {
      niche: ctx.run.nicheKey ?? dna.audience.markets[0] ?? "general",
      markets: dna.audience.markets,
      languages: dna.audience.languages,
      recentTitles: archive,
    })) as z.infer<typeof trendScout.output>;

    const ideas = (await runStageSkill(ctx, "idea-scorer", {
      niche: ctx.channel?.niche ?? "general",
      audienceSummary: dna.audience.summary,
      trends: trends.trends.map((t) => `${t.topic} (${t.momentum}): ${t.why}`),
      recentTitles: archive,
      howMany: 5,
    })) as z.infer<typeof ideaScorer.output>;

    const chosen =
      ideas.ideas.find((i) => i.title === ideas.recommendation.title) ??
      [...ideas.ideas].sort((a, b) => b.score - a.score)[0];
    if (!chosen) throw validationFailed("idea-scorer returned no usable idea");

    const dedup = (await runStageSkill(ctx, "dedup-detector", {
      candidate: `${chosen.title} ${chosen.angle}`,
      archive,
    })) as z.infer<typeof dedupDetector.output>;
    if (dedup.duplicate) {
      return {
        output: { rejected: { dedup, chosen } },
        retry: {
          reason: `الفكرة مكررة (${Math.round(dedup.maxScore * 100)}% مقابل "${dedup.against}")`,
          fixes: [{ text: "اختر زاوية جديدة مختلفة عن الأرشيف", stage: "S2" }],
        },
      };
    }

    const haystack = `${chosen.title} ${chosen.angle}`.toLowerCase();
    const sensitiveHits = CONFIG.sensitiveKeywords.filter((k) => haystack.includes(k.toLowerCase()));
    if (sensitiveHits.length) {
      return {
        output: { blocked: sensitiveHits, chosen },
        hold: { kind: "qa", reason: `الفكرة تلامس عبارات حساسة: ${sensitiveHits.join("، ")} — تحتاج قراراً بشرياً` },
      };
    }

    const series = (await runStageSkill(ctx, "series-planner", {
      chosenIdea: { title: chosen.title, angle: chosen.angle, targetAudience: chosen.targetAudience, whyNow: chosen.whyNow },
      niche: ctx.channel?.niche ?? "general",
      recentTitles: archive,
    })) as z.infer<typeof seriesPlanner.output>;

    const pack = {
      trends: trends.trends,
      ideas: ideas.ideas,
      chosen: { title: chosen.title, angle: chosen.angle, targetAudience: chosen.targetAudience, whyNow: chosen.whyNow },
      series,
      writerFamily,
    };
    const parsed = ResearchPackageSchema.safeParse(pack);
    if (!parsed.success) throw validationFailed("research package invalid", parsed.error.issues.slice(0, 5));

    return {
      output: { ...parsed.data, rulesUsed: ruleLines(dna).length, recommendation: ideas.recommendation, arabic: isArabic(ctx.run.locale, dna.audience.markets) },
      score: chosen.score,
      checkpoint: { chosenTitle: chosen.title },
    };
  },

  async validate(ctx, result) {
    const out = result.output as { trends?: unknown; ideas?: unknown; chosen?: unknown; series?: unknown; writerFamily?: unknown };
    const summary = await runChecks(
      [
        {
          key: "research.package",
          run: () => {
            // re-parse only the contract fields: stage outputs carry extras
            const candidate =
              out.chosen !== undefined
                ? {
                    trends: out.trends,
                    ideas: out.ideas,
                    chosen: out.chosen,
                    series: out.series,
                    writerFamily: out.writerFamily,
                  }
                : null;
            const parsed = ResearchPackageSchema.safeParse(candidate);
            return parsed.success
              ? { key: "research.package", pass: true, severity: "info" as const }
              : { key: "research.package", pass: false, severity: "fail" as const, message: "حزمة البحث غير صالحة" };
          },
        },
      ],
      null,
    );
    void ctx;
    return summary.outcomes;
  },
});
