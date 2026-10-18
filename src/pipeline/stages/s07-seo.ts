/**
 * S7 — SEO pack: chapters -> titles -> thumbnails -> art direction ->
 * description/tags -> disclosure -> the promise triple.
 * Text-tier; produces the exact fields the upload consumes.
 */
import { z } from "zod";
import { providerMissing, validationFailed } from "../errors";
import { SeoPackSchema } from "../schemas/seo";
import { runChecks, type CheckOutcome } from "../checks";
import { checkDescription, checkTags, checkTitle } from "../checks/text";
import { dnaJson, outputOf } from "./_helpers";
import { defineStage, runStageSkill, type StageResult } from "../stage";
import type { titleLab } from "@/src/skills/s07/title-lab";
import type { thumbnailCopywriter } from "@/src/skills/s07/thumbnail-copywriter";
import type { designDescriber } from "@/src/skills/s07/design-describer";
import type { seoWriter } from "@/src/skills/s07/seo-writer";
import type { chaptersBuilder } from "@/src/skills/s07/chapters-builder";
import type { disclosureSetter } from "@/src/skills/s07/disclosure-setter";
import type { ResearchPackage, ScriptPackage } from "../schemas/script";
import type { EditList } from "../schemas/storyboard";

export const s07Seo = defineStage({
  key: "S7",
  index: 7,
  title: "SEO pack",
  costTier: "text",
  maxAttempts: 3,
  skills: ["title-lab", "thumbnail-copywriter", "design-describer", "seo-writer", "chapters-builder", "disclosure-setter"],

  async gate(ctx) {
    const families = await ctx.llm.families();
    if (families.length === 0) return { pass: false, code: "PROVIDER_MISSING", reason: "لا يوجد مزوّد نماذج مضبوط" };
    return { pass: true };
  },

  async execute(ctx): Promise<StageResult> {
    const dna = dnaJson(ctx);
    const research = outputOf<ResearchPackage>(ctx, "S2");
    const scriptPkg = outputOf<ScriptPackage>(ctx, "S3");
    const renderOut = outputOf<{ editList: EditList }>(ctx, "S6");
    const families = await ctx.llm.families();
    if (families.length === 0) throw providerMissing("LLM required for SEO pack");
    const market = dna.audience.markets[0] ?? "us";
    const arabic = ctx.run.locale.toLowerCase().startsWith("ar");

    const chapters = (await runStageSkill(ctx, "chapters-builder", {
      scenes: renderOut.editList.clips.map((c, i) => ({
        id: c.sceneId,
        seconds: c.endSec - c.startSec,
        label: (scriptPkg.structure[i]?.name ?? `الجزء ${i + 1}`).slice(0, 120),
      })),
      introLabel: arabic ? "البداية" : "Intro",
    })) as z.infer<typeof chaptersBuilder.output>;

    const titles = (await runStageSkill(ctx, "title-lab", {
      ideaTitle: research.chosen.title,
      promiseCore: research.chosen.angle.slice(0, 300),
      market,
      recentTitles: await ctx.store.listArchiveTitles(ctx.run.channelId, 30),
    })) as z.infer<typeof titleLab.output>;

    const thumbnails = (await runStageSkill(ctx, "thumbnail-copywriter", {
      ideaTitle: research.chosen.title,
      promiseCore: research.chosen.angle.slice(0, 300),
      market,
    })) as z.infer<typeof thumbnailCopywriter.output>;

    const design = (await runStageSkill(ctx, "design-describer", {
      titles: titles.titles.map((t) => t.text),
      concepts: thumbnails.concepts.map((c) => ({ overlayText: c.overlayText, concept: c.concept })),
      markets: dna.audience.markets,
      avatarDescription: (dna.avatar as { description?: string } | undefined)?.description,
    })) as z.infer<typeof designDescriber.output>;

    const seo = (await runStageSkill(ctx, "seo-writer", {
      title: titles.titles[0].text,
      ideaAngle: research.chosen.angle,
      audienceSummary: dna.audience.summary,
      beats: scriptPkg.structure.map((b) => b.name),
      chapters: chapters.chapters,
      markets: dna.audience.markets,
      trends: research.trends.map((t) => t.topic),
    })) as z.infer<typeof seoWriter.output>;

    const disclosure = (await runStageSkill(ctx, "disclosure-setter", {
      hasSyntheticMedia: true,
      hasSyntheticVoice: true,
      locale: ctx.run.locale,
    })) as z.infer<typeof disclosureSetter.output>;

    const pack = {
      titles: titles.titles,
      chosenTitle: titles.titles[0].text,
      thumbnails: thumbnails.concepts,
      description: seo.description,
      tags: seo.tags,
      chapters: chapters.chapters,
      disclosure: disclosure.disclosure,
      promise: {
        title: titles.titles[0].text,
        thumbnail: thumbnails.concepts[0].overlayText,
        core: research.chosen.angle.slice(0, 300),
      },
    };
    const parsed = SeoPackSchema.safeParse(pack);
    if (!parsed.success) throw validationFailed("SEO pack invalid", parsed.error.issues.slice(0, 5));

    return {
      output: { ...parsed.data, design, chaptersSkipped: chapters.skipped, chaptersReason: chapters.reason ?? null },
      checkpoint: { chosenTitle: parsed.data.chosenTitle },
    };
  },

  async validate(_ctx, result): Promise<CheckOutcome[]> {
    const out = result.output as Partial<z.infer<typeof SeoPackSchema>>;
    const parsed = SeoPackSchema.safeParse({
      titles: out.titles,
      chosenTitle: out.chosenTitle,
      thumbnails: out.thumbnails,
      description: out.description,
      tags: out.tags,
      chapters: out.chapters ?? [],
      disclosure: out.disclosure,
      promise: out.promise,
    });
    if (!parsed.success) {
      return [{ key: "seo.schema", pass: false, severity: "fail", message: `حزمة SEO غير صالحة: ${parsed.error.issues[0]?.message}`, fixStage: "S7" }];
    }
    const summary = await runChecks([checkTitle, checkDescription, checkTags], {
      title: parsed.data.chosenTitle,
      description: parsed.data.description,
      tags: parsed.data.tags,
    });
    const issues: CheckOutcome[] = [...summary.outcomes];
    const inList = parsed.data.titles.some((t) => t.text === parsed.data.chosenTitle);
    issues.push({ key: "seo.chosen-in-list", pass: inList, severity: "fail", message: inList ? undefined : "العنوان المختار ليس ضمن القائمة المقترحة", fixStage: "S7" });
    const longOverlays = parsed.data.thumbnails.filter((t) => t.overlayText.trim().split(/\s+/).filter(Boolean).length > 4);
    issues.push({
      key: "seo.overlay-words",
      pass: longOverlays.length === 0,
      severity: "fail",
      message: longOverlays.length ? `نص مصغرة أطول من 4 كلمات: ${longOverlays[0].overlayText}` : undefined,
      fix: "اختصر نص الصورة المصغرة إلى 4 كلمات أو أقل",
      fixStage: "S7",
    });
    return issues;
  },
});
