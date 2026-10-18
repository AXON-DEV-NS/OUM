import { z } from "zod";
import { defineSkill } from "@/src/skills/_types";

export const Input = z.strictObject({
  facts: z.strictObject({
    storeOk: z.boolean(),
    channelLinked: z.boolean(),
    dnaApproved: z.boolean(),
    llmFamilies: z.array(z.string().max(20)).max(5),
    youtubeToken: z.strictObject({ present: z.boolean(), expired: z.boolean() }),
    costCapCents: z.number().int(),
    ffprobe: z.boolean(),
  }),
});

export const Output = z.strictObject({
  ok: z.boolean(),
  findings: z
    .array(
      z.strictObject({
        name: z.string().max(60),
        level: z.enum(["fail", "warn", "info"]),
        message: z.string().max(400),
        fix: z.string().max(300).optional(),
      }),
    )
    .max(12),
});

export const healthMonitor = defineSkill({
  key: "health-monitor",
  version: "1.0.0",
  goal: "Preflight health of everything the run depends on — pure code, no spending, before the first paid call.",
  kind: "code",
  path: "any",
  stages: ["S1"],
  input: Input,
  output: Output,
  checklist: [
    "no LLM family configured -> fail (nothing can run)",
    "YouTube token missing/expired -> fail (nothing can be published)",
    "DNA not approved or channel not linked -> fail",
    "cost cap <= 0 -> fail",
    "ffprobe missing -> warn only (needed from render stage onward)",
  ],
  examples: [
    {
      name: "healthy",
      input: {
        facts: { storeOk: true, channelLinked: true, dnaApproved: true, llmFamilies: ["deepseek", "openai"], youtubeToken: { present: true, expired: false }, costCapCents: 1500, ffprobe: false },
      },
      expectOutput: { ok: true },
    },
    {
      name: "no-providers",
      input: {
        facts: { storeOk: true, channelLinked: true, dnaApproved: true, llmFamilies: [], youtubeToken: { present: true, expired: false }, costCapCents: 1500, ffprobe: true },
      },
      expectOutput: { ok: false },
    },
  ],
  implemented: true,
  async run(_rt, input) {
    const f = input.facts;
    const findings: Array<{ name: string; level: "fail" | "warn" | "info"; message: string; fix?: string }> = [];
    const add = (name: string, level: "fail" | "warn" | "info", message: string, fix?: string) => findings.push({ name, level, message, ...(fix ? { fix } : {}) });

    if (!f.storeOk) add("store", "fail", "قاعدة البيانات لا تستجيب", "تحقق من تشغيل PostgreSQL و DATABASE_URL");
    if (!f.channelLinked) add("channel", "fail", "لا توجد قناة يوتيوب مربوطة بالحساب", "اربط القناة من صفحة الإعداد");
    if (!f.dnaApproved) add("dna", "fail", "هوية القناة (DNA) غير معتمدة", "اعتمد الاقتراح في مرحلة S0 أولاً");
    if (f.llmFamilies.length === 0) add("llm", "fail", "لا يوجد أي مزوّد نماذج مضبوط", "أضف DEEPSEEK_API_KEY أو OPENAI_API_KEY في إعدادات المفاتيح");
    else if (f.llmFamilies.length === 1) add("llm", "warn", `عائلة نماذج واحدة فقط (${f.llmFamilies[0]}) — مرحلة القاضي ستحتاج عائلة ثانية`, "أضف مفتاح مزود ثانٍ لتفعيل «القاضي غير الكاتب»");
    if (!f.youtubeToken.present) add("youtube", "fail", "لا يوجد توكن YouTube مرتبط", "أعد ربط القناة لمنح صلاحية الرفع");
    else if (f.youtubeToken.expired) add("youtube", "fail", "توكن YouTube منتهٍ", "أعد ربط القناة لتجديد التوكن");
    if (f.costCapCents <= 0) add("budget", "fail", "سقف التكلفة غير مضبوط", "حدد سقفاً أكبر من صفر");
    if (!f.ffprobe) add("media-tools", "warn", "ffprobe غير مثبت — فحوص الوسائط ستُتخطى", "ثبّت ffmpeg لتفعيل فحوص الدقة/الصوت");

    return { ok: !findings.some((x) => x.level === "fail"), findings };
  },
});
