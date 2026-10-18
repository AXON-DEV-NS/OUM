/**
 * S0 — Setup / channel DNA.
 * Compiles client instructions into machine-checkable rules, checks the
 * avatar image (avatar path), suggests competitors, and produces a DNA draft
 * that the CLIENT approves ("this is what I understood") before any spend.
 */
import { z } from "zod";
import { ChannelDnaSchema } from "../schemas/dna";
import { validationFailed } from "../errors";
import type { DnaUpsert } from "../store";
import { defineStage, runStageSkill, type StageResult } from "../stage";
import { parseImageSize } from "@/src/skills/s00/avatar-image-checker";
import type { instructionsConverter } from "@/src/skills/s00/instructions-converter";
import type { conflictDetector } from "@/src/skills/s00/conflict-detector";
import type { competitorAnalyzer } from "@/src/skills/s00/competitor-analyzer";
import type { referenceDecomposer } from "@/src/skills/s00/reference-decomposer";
import type { avatarImageChecker } from "@/src/skills/s00/avatar-image-checker";
import type { audienceEmbedder } from "@/src/skills/s00/audience-embedder";

export const s00Setup = defineStage({
  key: "S0",
  index: 0,
  title: "Setup / channel DNA",
  costTier: "free",
  maxAttempts: 2,
  skills: ["instructions-converter", "conflict-detector", "competitor-analyzer", "reference-decomposer", "avatar-image-checker", "audience-embedder"],

  async gate(ctx) {
    if (!ctx.channel) return { pass: false, code: "GATE_BLOCKED", reason: "قناة غير موجودة — اربط قناة أولاً" };
    const families = await ctx.llm.families();
    if (families.length === 0) {
      return { pass: false, code: "PROVIDER_MISSING", reason: "لا يوجد مزوّد نماذج — أضف مفتاح DeepSeek أو OpenAI لتوليد هوية القناة" };
    }
    return { pass: true };
  },

  async execute(ctx): Promise<StageResult> {
    const channel = ctx.channel!;
    if (ctx.dna?.approvedAt) {
      return { output: { draft: null, alreadyApproved: true, version: ctx.dna.version }, requiresHuman: false };
    }

    // fail cheap: avatar path needs a good image BEFORE any llm spend
    let avatar: { description?: string; imageOk?: boolean; imageIssues?: string[] } | undefined;
    if (ctx.usesAvatar()) {
      const buf = channel.avatarImageBuffer;
      const size = buf ? parseImageSize(buf) : null;
      if (!size) {
        return { output: { blocked: "no-avatar-image" }, hold: { kind: "gate", reason: "مسار الأفاتار يحتاج صورة أفاتار مرفوعة — ارفع صورة واضحة ثم أعد المحاولة" } };
      }
      const chk = (await runStageSkill(ctx, "avatar-image-checker", {
        width: size.width,
        height: size.height,
        bytes: channel.avatarImageBytes ?? 0,
        format: size.format,
      })) as z.infer<typeof avatarImageChecker.output>;
      if (!chk.ok) {
        return { output: { blocked: "bad-avatar-image", issues: chk.issues }, hold: { kind: "gate", reason: chk.issues.join("؛ ") } };
      }
      avatar = { imageOk: chk.ok, imageIssues: [] };
    }

    const instructions = [channel.customInstructions ?? "", channel.tone ? `النبرة المطلوبة: ${channel.tone}` : ""].filter(Boolean).join("\n");

    const conv = (await runStageSkill(ctx, "instructions-converter", {
      instructions,
      channelTitle: channel.title,
      niche: channel.niche ?? undefined,
      markets: channel.markets,
      tone: channel.tone ?? undefined,
    })) as z.infer<typeof instructionsConverter.output>;

    const det = (await runStageSkill(ctx, "conflict-detector", { rules: conv.rules })) as z.infer<typeof conflictDetector.output>;

    const comp = (await runStageSkill(ctx, "competitor-analyzer", {
      channelTitle: channel.title,
      niche: channel.niche ?? undefined,
      markets: channel.markets,
      urls: channel.referenceChannelUrl ? [channel.referenceChannelUrl] : [],
      notes: channel.customInstructions ?? undefined,
      mode: channel.referenceChannelUrl ? "analyze" : "suggest",
    })) as z.infer<typeof competitorAnalyzer.output>;

    let reference: z.infer<typeof referenceDecomposer.output> | null = null;
    if (channel.referenceVideoUrl) {
      reference = (await runStageSkill(ctx, "reference-decomposer", { referenceVideoUrl: channel.referenceVideoUrl })) as z.infer<typeof referenceDecomposer.output>;
    }

    const audience = (await runStageSkill(ctx, "audience-embedder", {
      channelTitle: channel.title,
      niche: channel.niche ?? undefined,
      markets: channel.markets,
      languages: [ctx.run.locale],
      tone: channel.tone ?? undefined,
    })) as z.infer<typeof audienceEmbedder.output>;

    const candidate = {
      rules: det.cleaned,
      conflicts: det.conflicts,
      competitors: comp.competitors,
      audience: audience.audience,
      avatar,
      mode: {
        path: ctx.run.path,
        voiceStyle: channel.tone ?? undefined,
        format: { vertical: true, targetMinutes: 3 },
      },
    };
    const parsed = ChannelDnaSchema.safeParse(candidate);
    if (!parsed.success) throw validationFailed("assembled DNA failed schema validation", parsed.error.issues.slice(0, 5));

    const record = await ctx.store.upsertDna(channel.id, parsed.data as unknown as DnaUpsert);
    const highConflicts = det.conflicts.filter((c) => c.severity === "high");

    await ctx.notify({
      kind: "approval_needed",
      runId: ctx.run.id,
      userId: ctx.run.userId,
      title: "S0: هوية القناة جاهزة للاعتماد",
      body: `${det.cleaned.length} قاعدة، ${highConflicts.length} تعارض جدي، ${comp.suggestions.length} اقتراح منافسين. راجع واعتمد قبل بدء الإنتاج.`,
    });

    return {
      output: {
        draft: parsed.data,
        version: record.version,
        rulesCount: det.cleaned.length,
        droppedDuplicates: det.droppedDuplicates,
        conflicts: det.conflicts,
        competitorSuggestions: comp.suggestions,
        reference,
        avatar,
        summary: [
          `عدد القواعد: ${det.cleaned.length} (حُذف ${det.droppedDuplicates} مكرر)`,
          highConflicts.length ? `تعارضات تحتاج حسم: ${highConflicts.map((c) => `${c.a}/${c.b}`).join("، ")}` : "لا تعارضات جوهرية",
          comp.competitors.length ? `منافسون محللون: ${comp.competitors.length}` : "لا منافسين محللين — راجع الاقتراحات",
          reference ? (reference.analyzed ? "تم تحليل الفيديو المرجعي" : "الفيديو المرجعي يحتاج ملاحظات/نصاً للتحليل") : "بدون فيديو مرجعي",
        ],
      },
      checkpoint: { stage: "dna-draft", version: record.version },
      requiresHuman: true,
    };
  },

  async validate(ctx, result) {
    const out = result.output as { alreadyApproved?: boolean; draft?: unknown };
    if (out.alreadyApproved) return [];
    const parsed = ChannelDnaSchema.safeParse(out.draft);
    const issues = [];
    if (!parsed.success) {
      issues.push({ key: "dna.schema", pass: false, severity: "fail" as const, message: `مسودة DNA غير صالحة: ${parsed.error.issues[0]?.message}` });
      return issues;
    }
    issues.push({ key: "dna.rules", pass: parsed.data.rules.length >= 3, severity: "fail" as const, message: parsed.data.rules.length >= 3 ? undefined : "أقل من 3 قواعد" });
    const high = parsed.data.conflicts.filter((c) => c.severity === "high");
    if (high.length) issues.push({ key: "dna.conflicts", pass: false, severity: "warn" as const, message: `${high.length} تعارض جدي يحتاج قرار العميل` });
    if (ctx.usesAvatar() && parsed.data.avatar && parsed.data.avatar.imageOk === false) {
      issues.push({ key: "dna.avatar", pass: false, severity: "warn" as const, message: "صورة الأفاتار بها ملاحظات" });
    }
    return issues;
  },
});

export type S00Output = { draft: unknown; version: number; summary: string[]; conflicts: unknown[] };
