/**
 * S1 — Preflight health (the fail-cheap gate).
 * Pure code: provider keys, YouTube token, DNA approval, budget floor.
 * Nothing paid runs before this stage is green.
 */
import { z } from "zod";
import { TIER_FLOOR_CENTS } from "../guards/tier";
import { ffprobeAvailable } from "../checks/media";
import { dnaJson } from "./_helpers";
import { defineStage, runStageSkill, type StageResult } from "../stage";
import type { healthMonitor } from "@/src/skills/s01/health-monitor";
import type { quotaCostCalculator } from "@/src/skills/s01/quota-cost-calculator";

export const s01Preflight = defineStage({
  key: "S1",
  index: 1,
  title: "Preflight health",
  costTier: "free",
  maxAttempts: 2,
  skills: ["health-monitor", "quota-cost-calculator"],

  async gate() {
    return { pass: true };
  },

  async execute(ctx): Promise<StageResult> {
    dnaJson(ctx); // throws when DNA is malformed — fail cheap
    const families = await ctx.llm.families();
    const yt = await ctx.youtube.configured(ctx.run.channelId);
    const channel = ctx.channel;

    const health = (await runStageSkill(ctx, "health-monitor", {
      facts: {
        storeOk: true,
        channelLinked: !!channel,
        dnaApproved: !!ctx.dna?.approvedAt,
        llmFamilies: families,
        youtubeToken: { present: !!channel?.hasAccessToken, expired: !!channel?.tokenExpired },
        costCapCents: ctx.run.costCapCents,
        ffprobe: ffprobeAvailable(),
      },
    })) as z.infer<typeof healthMonitor.output>;

    const upcomingFloors = [
      { tier: "text", floorCents: TIER_FLOOR_CENTS.text },
      { tier: "image", floorCents: TIER_FLOOR_CENTS.image },
      { tier: "video", floorCents: TIER_FLOOR_CENTS.video },
    ];
    const cost = (await runStageSkill(ctx, "quota-cost-calculator", {
      costCapCents: ctx.run.costCapCents,
      spentCents: ctx.run.costSpentCents,
      upcomingFloors,
    })) as z.infer<typeof quotaCostCalculator.output>;

    const output = { health, cost, youtubeConfigured: yt };
    const firstFail = health.findings.find((f) => f.level === "fail");
    if (firstFail) {
      return { output, hold: { kind: "gate", reason: `${firstFail.message}${firstFail.fix ? ` — ${firstFail.fix}` : ""}` } };
    }
    if (!cost.affordable) {
      return { output, hold: { kind: "budget", reason: cost.verdict } };
    }
    return { output };
  },

  async validate(_ctx, result) {
    const out = result.output as { health: { ok: boolean }; cost: { affordable: boolean } };
    return [
      { key: "preflight.health", pass: out.health.ok, severity: "fail" as const, message: out.health.ok ? undefined : "فحوص الصحة بها فشل" },
      { key: "preflight.budget", pass: out.cost.affordable, severity: "fail" as const, message: out.cost.affordable ? undefined : "الميزانية لا تغطي المراحل القادمة" },
    ];
  },
});
