import { z } from "zod";
import { defineSkill } from "@/src/skills/_types";

export const Input = z.strictObject({
  sceneIds: z.array(z.string().max(40)).min(1).max(80),
  avatarRef: z.string().max(2048),
});

export const Output = z.strictObject({
  ok: z.boolean(),
  issues: z.array(z.string().max(300)).max(20),
});

export const avatarFingerprintGuard = defineSkill({
  key: "avatar-fingerprint-guard",
  version: "1.0.0",
  goal: "Verify that every generated avatar frame matches the client's avatar reference (visual consistency guard).",
  kind: "llm",
  path: "avatar",
  stages: ["S4", "S5"],
  input: Input,
  output: Output,
  checklist: ["vision model required", "compares each scene frame against the avatar reference", "flags drift as blocking"],
  examples: [{ name: "placeholder", input: { sceneIds: ["s1"], avatarRef: "channel-avatar" } }],
  implemented: false,
  reason: "wave 2: needs a vision model + generated avatar frames; cannot run before media generation exists. Avatar runs park at S5 with a clear message.",
});
