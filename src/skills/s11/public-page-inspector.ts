import { z } from "zod";
import { fetchWithLimits } from "@/src/pipeline/checks/links";
import { defineSkill } from "@/src/skills/_types";

export const Input = z.strictObject({
  publicUrl: z.string().max(2048),
  expectedTitle: z.string().max(140).optional(),
  /** test/hook: pre-captured page snapshot; when absent a bounded live fetch runs */
  pageSnapshot: z
    .strictObject({ httpStatus: z.number().int().min(0).max(599), contentType: z.string().max(200).nullable(), bodyText: z.string().max(200_000) })
    .nullable()
    .default(null),
});

export const Output = z.strictObject({
  ok: z.boolean(),
  checks: z
    .array(z.strictObject({ key: z.string().max(60), ok: z.boolean(), message: z.string().max(300) }))
    .max(10),
});

const UNAVAILABLE_MARKERS = ["video unavailable", "this video isn't available", "هذا الفيديو غير متوفر", "الفيديو غير متاح"];

export const publicPageInspector = defineSkill({
  key: "public-page-inspector",
  version: "1.0.0",
  goal: "Post-publish inspection of the PUBLIC page: reachable, real HTML, title present, not taken down.",
  kind: "code",
  path: "any",
  stages: ["S11"],
  input: Input,
  output: Output,
  checklist: [
    "http status is 2xx",
    "content-type is HTML",
    "no 'video unavailable' markers in the body",
    "expected title fragment found (case-insensitive) when provided",
  ],
  examples: [
    {
      name: "healthy-page",
      input: {
        publicUrl: "https://www.youtube.com/watch?v=abc",
        expectedTitle: "لماذا تسخن",
        pageSnapshot: { httpStatus: 200, contentType: "text/html; charset=utf-8", bodyText: "<title>لماذا تسخن بطاريات هواتفنا؟</title>" },
      },
      expectOutput: { ok: true },
    },
    {
      name: "removed-video",
      input: {
        publicUrl: "https://www.youtube.com/watch?v=abc",
        pageSnapshot: { httpStatus: 200, contentType: "text/html", bodyText: "Video unavailable" },
      },
      expectOutput: { ok: false },
    },
  ],
  implemented: true,
  async run(_rt, input) {
    const checks: Array<{ key: string; ok: boolean; message: string }> = [];
    let status = 0;
    let contentType: string | null = null;
    let body = "";

    if (input.pageSnapshot) {
      status = input.pageSnapshot.httpStatus;
      contentType = input.pageSnapshot.contentType;
      body = input.pageSnapshot.bodyText;
    } else {
      const res = await fetchWithLimits(input.publicUrl, { wantBody: true, maxBytes: 400_000 });
      status = res.status;
      contentType = res.contentType;
      body = res.bodySnippet ?? "";
      if (!res.ok) checks.push({ key: "page.reachable", ok: false, message: res.reason ?? `HTTP ${res.status}` });
    }

    checks.push({ key: "page.status", ok: status >= 200 && status < 300, message: `HTTP ${status}` });
    checks.push({ key: "page.html", ok: !!contentType && contentType.includes("html"), message: contentType ?? "no content-type" });
    const lower = body.toLowerCase();
    const unavailable = UNAVAILABLE_MARKERS.find((m) => lower.includes(m));
    checks.push({ key: "page.available", ok: !unavailable, message: unavailable ? `found marker: ${unavailable}` : "page looks available" });
    if (input.expectedTitle) {
      const fragment = input.expectedTitle.slice(0, Math.min(24, input.expectedTitle.length)).toLowerCase();
      checks.push({ key: "page.title", ok: lower.includes(fragment), message: lower.includes(fragment) ? "title found" : `title fragment "${fragment}" not found` });
    }
    return { ok: checks.every((c) => c.ok), checks };
  },
});
