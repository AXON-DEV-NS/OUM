import { z } from "zod";
import { defineSkill } from "@/src/skills/_types";

export const Input = z.strictObject({
  assets: z
    .array(
      z.strictObject({
        assetId: z.string().max(60).optional(),
        kind: z.string().max(30),
        source: z.enum(["generated", "licensed", "uploaded"]),
        provider: z.string().max(60).nullable(),
        license: z.string().max(120).nullable(),
        licenseUrl: z.string().max(2048).nullable(),
        filePath: z.string().max(1024).nullable(),
      }),
    )
    .max(300),
});

export const Output = z.strictObject({
  ok: z.boolean(),
  issues: z.array(z.strictObject({ assetId: z.string().max(60).nullable(), problem: z.string().max(300) })).max(300),
});

export const rightsChecker = defineSkill({
  key: "rights-checker",
  version: "1.0.0",
  goal: "Pure-code rights audit: every generated asset names its provider; every licensed asset carries license + source URL.",
  kind: "code",
  path: "any",
  stages: ["S8"],
  input: Input,
  output: Output,
  checklist: [
    "generated -> provider must be recorded",
    "licensed -> license AND licenseUrl required",
    "uploaded -> license must state ownership (user-owned)",
    "an empty asset list passes (text-only artifacts)",
  ],
  examples: [
    {
      name: "licensed-without-url",
      input: { assets: [{ kind: "clip", source: "licensed", provider: null, license: "CC0", licenseUrl: null, filePath: "x.mp4" }] },
      expectOutput: { ok: false },
    },
    { name: "empty", input: { assets: [] }, expectOutput: { ok: true } },
  ],
  implemented: true,
  async run(_rt, input) {
    const issues: Array<{ assetId: string | null; problem: string }> = [];
    for (const a of input.assets) {
      if (a.source === "generated") {
        if (!a.provider) issues.push({ assetId: a.assetId ?? null, problem: `الأصل المولَّد (${a.kind}) بدون مزوّد مسجَّل` });
        if (!a.filePath) issues.push({ assetId: a.assetId ?? null, problem: `الأصل المولَّد (${a.kind}) بدون ملف` });
      } else if (a.source === "licensed") {
        if (!a.license) issues.push({ assetId: a.assetId ?? null, problem: `الأصل المرخص (${a.kind}) بدون نوع ترخيص` });
        if (!a.licenseUrl) issues.push({ assetId: a.assetId ?? null, problem: `الأصل المرخص (${a.kind}) بدون رابط مصدر الترخيص` });
      } else {
        if (!a.license || !/user-owned|ملك|المستخدم/i.test(a.license)) {
          issues.push({ assetId: a.assetId ?? null, problem: `الأصل المرفوع (${a.kind}) بدون إثبات ملكية` });
        }
      }
    }
    return { ok: issues.length === 0, issues };
  },
});
