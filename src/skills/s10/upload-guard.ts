import { z } from "zod";
import { stepKey } from "@/src/pipeline/guards/idempotency";
import { CONFIG } from "@/src/pipeline/config";
import { defineSkill } from "@/src/skills/_types";

export const Input = z.strictObject({
  runId: z.string().min(3).max(60),
  channelId: z.string().min(3).max(60),
  title: z.string().min(8).max(100),
  description: z.string().min(80).max(5000),
  tags: z.array(z.string().max(60)).max(30),
  filePath: z.string().min(3).max(1024),
  scheduledForIso: z.string().max(40).nullable(),
  disclosureRequired: z.boolean(),
  disclosureText: z.string().max(400),
  madeForKids: z.boolean(),
});

export const Output = z.strictObject({
  ok: z.boolean(),
  problems: z.array(z.string().max(300)).max(12),
  spec: z.strictObject({
    idempotencyKey: z.string().min(8).max(120),
    privacy: z.literal("private"),
    title: z.string().max(100),
    description: z.string().max(5000),
    tags: z.array(z.string().max(60)).max(30),
    filePath: z.string().max(1024),
    madeForKids: z.boolean(),
    scheduledForIso: z.string().max(40).nullable(),
    /** description after appending the disclosure line */
    descriptionWithDisclosure: z.string().max(5000),
  }),
});

export const uploadGuard = defineSkill({
  key: "upload-guard",
  version: "1.0.0",
  goal: "Build AND validate the upload spec: deterministic idempotency key, private-first privacy, disclosure appended to the description.",
  kind: "code",
  path: "any",
  stages: ["S10"],
  input: Input,
  output: Output,
  checklist: [
    "privacy is always 'private' (private-first)",
    "idempotency key = run:S10:upload (stable across retries)",
    "title <= 100, description <= 5000 after appending disclosure",
    "problems list is empty before any network call happens",
  ],
  examples: [
    {
      name: "valid-spec",
      input: {
        runId: "run_1",
        channelId: "chan_1",
        title: "لماذا تسخن بطارية هاتفك؟",
        description: "شرح علمي مبسط لأسباب ارتفاع حرارة البطارية وطرق الوقاية العملية اليومية التي يمكنك تطبيقها بسهولة.".padEnd(90, " "),
        tags: ["بطارية"],
        filePath: "/tmp/final.mp4",
        scheduledForIso: null,
        disclosureRequired: true,
        disclosureText: "يحتوي هذا الفيديو على مشاهد وصوت مولّدين بالذكاء الاصطناعي.",
        madeForKids: false,
      },
      expectOutput: { ok: true, spec: { privacy: "private" } },
    },
  ],
  implemented: true,
  async run(_rt, input): Promise<z.infer<typeof Output>> {
    const problems: string[] = [];
    if (input.title.trim().length < 8) problems.push("العنوان قصير جداً");
    if (input.description.trim().length < CONFIG.lengths.descriptionMinChars) problems.push("الوصف قصير جداً");
    const withDisclosure = input.disclosureRequired
      ? `${input.description}\n\n${input.disclosureText}`.slice(0, CONFIG.lengths.descriptionMaxChars)
      : input.description;
    if (withDisclosure.length > CONFIG.lengths.descriptionMaxChars) problems.push("الوصف يتجاوز 5000 حرف بعد إضافة الإفصاح");
    const tagTotal = input.tags.reduce((s, t) => s + t.length + 1, 0);
    if (tagTotal > CONFIG.lengths.tagsMaxTotalChars) problems.push("إجمالي الوسوم يتجاوز 500 حرف");
    if (!input.filePath.trim()) problems.push("لا يوجد ملف فيديو جاهز للرفع");
    if (!input.runId || !input.channelId) problems.push("معرفات ناقصة (run/channel)");
    if (input.scheduledForIso && Number.isNaN(Date.parse(input.scheduledForIso))) problems.push("موعد الجدولة غير صالح");

    return {
      ok: problems.length === 0,
      problems,
      spec: {
        idempotencyKey: stepKey(input.runId, "S10", "upload"),
        privacy: "private",
        title: input.title.slice(0, 100),
        description: input.description,
        tags: input.tags,
        filePath: input.filePath,
        madeForKids: input.madeForKids,
        scheduledForIso: input.scheduledForIso,
        descriptionWithDisclosure: withDisclosure,
      },
    };
  },
});
