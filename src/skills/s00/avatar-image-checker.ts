import { z } from "zod";
import { defineSkill } from "@/src/skills/_types";

export const Input = z.strictObject({
  width: z.number().int().min(1).max(20000),
  height: z.number().int().min(1).max(20000),
  bytes: z.number().int().min(1),
  format: z.enum(["png", "jpeg", "webp", "gif", "unknown"]),
});

export const Output = z.strictObject({
  ok: z.boolean(),
  issues: z.array(z.string().max(300)).max(10),
  manualReview: z.boolean(),
});

export interface ImageSize {
  width: number;
  height: number;
  format: "png" | "jpeg" | "webp" | "gif" | "unknown";
}

/** dependency-free image size parser (PNG/JPEG/WebP/GIF headers) */
export function parseImageSize(buf: Uint8Array): ImageSize | null {
  const b = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) {
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), format: "png" };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7), format: "jpeg" };
      }
      const len = b.readUInt16BE(i + 2);
      if (len < 2) return null;
      i += 2 + len;
    }
    return null;
  }
  if (b.length > 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const kind = b.toString("ascii", 12, 16);
    if (kind === "VP8X") return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3), format: "webp" };
    if (kind === "VP8 ") return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff, format: "webp" };
    if (kind === "VP8L") {
      const bits = b.readUInt32LE(21);
      return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff), format: "webp" };
    }
    return null;
  }
  if (b.length > 10 && b.toString("ascii", 0, 3) === "GIF") {
    return { width: b.readUInt16LE(6), height: b.readUInt16LE(8), format: "gif" };
  }
  return null;
}

export const avatarImageChecker = defineSkill({
  key: "avatar-image-checker",
  version: "1.0.0",
  goal: "Deterministic quality gate for the uploaded avatar image (size, aspect, weight, format) before any expensive generation.",
  kind: "code",
  path: "avatar",
  stages: ["S0"],
  input: Input,
  output: Output,
  checklist: [
    "min 512x512 px",
    "aspect ratio between 0.4 and 2.5",
    "file size <= 8 MB",
    "png/jpeg/webp only (no gif)",
    "face/likeness quality flagged for manual review (no vision model in wave 1)",
  ],
  examples: [
    { name: "good-portrait", input: { width: 1024, height: 1536, bytes: 400_000, format: "png" }, expectOutput: { ok: true } },
    { name: "tiny", input: { width: 256, height: 256, bytes: 40_000, format: "png" }, expectOutput: { ok: false } },
  ],
  implemented: true,
  async run(_rt, input) {
    const issues: string[] = [];
    if (input.width < 512 || input.height < 512) issues.push(`الصورة صغيرة (${input.width}x${input.height}) — الحد الأدنى 512x512`);
    const ratio = input.width / input.height;
    if (ratio < 0.4 || ratio > 2.5) issues.push(`نسبة الأبعاد غير معتادة (${ratio.toFixed(2)}) — استخدم صورة شخصية طبيعية`);
    if (input.bytes > 8 * 1024 * 1024) issues.push("حجم الصورة أكبر من 8MB");
    if (input.format === "gif") issues.push("الصور المتحركة (GIF) غير مقبولة — استخدم صورة ثابتة");
    if (input.format === "unknown") issues.push("صيغة الصورة غير معروفة — استخدم PNG/JPEG/WebP");
    return { ok: issues.length === 0, issues, manualReview: true };
  },
});
