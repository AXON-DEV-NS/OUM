/**
 * S3 — Script: hooks -> full script -> dialect polish -> retention structure
 * -> claims extraction -> independent claims verification -> brand rules.
 * The judge (claims-verifier) runs on a DIFFERENT model family than the writer.
 */
import { z } from "zod";
import { CONFIG } from "../config";
import { providerMissing, validationFailed } from "../errors";
import { ScriptPackageSchema } from "../schemas/script";
import { CheckOutcome } from "../checks";
import { runChecks } from "../checks";
import { checkAgainstArchive, checkHooks, checkScriptText } from "../checks/text";
import { dnaJson, isArabic, outputOf, ruleLines } from "./_helpers";
import { defineStage, runStageSkill, type StageResult } from "../stage";
import type { hookWriter } from "@/src/skills/s03/hook-writer";
import type { nicheWriter } from "@/src/skills/s03/niche-writer";
import type { dialectPolisher } from "@/src/skills/s03/dialect-polisher";
import type { retentionStructurer } from "@/src/skills/s03/retention-structurer";
import type { claimsExtractor } from "@/src/skills/s03/claims-extractor";
import type { claimsVerifier } from "@/src/skills/s03/claims-verifier";
import type { brandRulesEnforcer } from "@/src/skills/s03/brand-rules-enforcer";
import type { ResearchPackage } from "../schemas/script";

export const s03Script = defineStage({
  key: "S3",
  index: 3,
  title: "Script",
  costTier: "text",
  maxAttempts: 3,
  skills: ["hook-writer", "retention-structurer", "niche-writer", "dialect-polisher", "claims-extractor", "claims-verifier", "brand-rules-enforcer"],

  async gate(ctx) {
    const research = ctx.inputs.of("S2") as ResearchPackage | null;
    if (!research?.chosen) return { pass: false, code: "GATE_BLOCKED", reason: "لا توجد فكرة معتمدة من مرحلة البحث" };
    return { pass: true };
  },

  async execute(ctx): Promise<StageResult> {
    const dna = dnaJson(ctx);
    const research = outputOf<ResearchPackage>(ctx, "S2");
    const families = await ctx.llm.families();
    if (families.length === 0) throw providerMissing("LLM required for script writing");
    const writerFamily = families[0];
    const targetMinutes = dna.mode.format.targetMinutes;
    const arabic = isArabic(ctx.run.locale, dna.audience.markets);

    const hooks = (await runStageSkill(ctx, "hook-writer", {
      ideaTitle: research.chosen.title,
      angle: research.chosen.angle,
      audienceSummary: dna.audience.summary,
      tone: dna.mode.voiceStyle,
      markets: dna.audience.markets,
    })) as z.infer<typeof hookWriter.output>;

    const chosenHook = hooks.hooks[0];

    const written = (await runStageSkill(ctx, "niche-writer", {
      idea: research.chosen,
      audienceSummary: dna.audience.summary,
      rules: ruleLines(dna),
      chosenHook,
      targetMinutes,
      markets: dna.audience.markets,
    })) as z.infer<typeof nicheWriter.output>;

    let script = written.script;
    if (arabic) {
      const polished = (await runStageSkill(ctx, "dialect-polisher", {
        script,
        markets: dna.audience.markets,
        tone: dna.mode.voiceStyle,
      })) as z.infer<typeof dialectPolisher.output>;
      script = polished.script;
    }

    const retention = (await runStageSkill(ctx, "retention-structurer", {
      script,
      targetMinutes,
    })) as z.infer<typeof retentionStructurer.output>;
    if (retention.revisedScript) script = retention.revisedScript;

    const claims = (await runStageSkill(ctx, "claims-extractor", { script })) as z.infer<typeof claimsExtractor.output>;

    const verification = (await runStageSkill(ctx, "claims-verifier", {
      claims: claims.claims,
      writerFamily,
    })) as z.infer<typeof claimsVerifier.output>;

    const unsupported = claims.claims
      .map((c, i) => ({ claim: c, verdict: verification.verdicts.find((v) => v.index === i) }))
      .filter((x) => x.claim.needsSource && x.claim.kind !== "opinion" && x.verdict?.supported !== "yes");
    if (unsupported.length > 0) {
      return {
        output: { claims, verification, script },
        retry: {
          reason: `${unsupported.length} ادعاء يحتاج مصدراً أو تلطيفاً`,
          fixes: unsupported.slice(0, 5).map((u) => ({ text: `ادعاء بلا مصدر: ${u.claim.text.slice(0, 80)} — أضف مصدراً أو أعد صياغته كرأي`, stage: "S3" })),
        },
      };
    }

    const brand = (await runStageSkill(ctx, "brand-rules-enforcer", { script, rules: dna.rules })) as z.infer<typeof brandRulesEnforcer.output>;
    const hardViolations = brand.violations.filter((v) => v.hard);
    if (hardViolations.length > 0) {
      return {
        output: { brand, script },
        retry: {
          reason: `${hardViolations.length} خرق لقواعد العلامة`,
          fixes: hardViolations.slice(0, 5).map((v) => ({ text: `خرق قاعدة: ${v.ruleText} — الموضع: ${v.evidence}`, stage: "S3" })),
        },
      };
    }

    const pack = {
      idea: research.chosen,
      hooks: hooks.hooks,
      chosenHook,
      script,
      structure: retention.structure,
      claims: claims.claims,
      writerFamily,
    };
    const parsed = ScriptPackageSchema.safeParse(pack);
    if (!parsed.success) throw validationFailed("script package invalid", parsed.error.issues.slice(0, 5));

    return {
      output: {
        ...parsed.data,
        verification,
        brandSoftWarnings: brand.violations.filter((v) => !v.hard).length,
        arabic,
      },
      checkpoint: { hook: chosenHook },
    };
  },

  async validate(ctx, result): Promise<CheckOutcome[]> {
    const out = result.output as Partial<z.infer<typeof ScriptPackageSchema>> & { verification?: z.infer<typeof claimsVerifier.output> };
    if (!out.script || !out.hooks) return [{ key: "script.present", pass: false, severity: "fail", message: "لا يوجد نص/خطافات في المخرجات" }];
    const archive = await ctx.store.listArchiveTitles(ctx.run.channelId, CONFIG.similarity.archiveTitles);
    const dna = ctx.dna ? dnaJson(ctx) : null;
    const summary = await runChecks(
      [checkScriptText, checkHooks, checkAgainstArchive(() => archive)],
      {
        script: out.script,
        hooks: out.hooks,
        targetMinutes: dna?.mode.format.targetMinutes,
        text: out.script,
      },
    );
    return summary.outcomes;
  },
});
