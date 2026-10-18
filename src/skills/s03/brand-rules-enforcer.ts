import { z } from "zod";
import { RuleSchema } from "@/src/pipeline/schemas/dna";
import { extractTerms } from "@/src/skills/s00/conflict-detector";
import { defineSkill } from "@/src/skills/_types";

export const Input = z.strictObject({
  script: z.string().min(50).max(20000),
  title: z.string().max(200).optional(),
  rules: z.array(RuleSchema).max(120),
});

export const Output = z.strictObject({
  violations: z
    .array(z.strictObject({ ruleId: z.string().max(40), ruleText: z.string().max(420), evidence: z.string().max(200), hard: z.boolean() }))
    .max(30),
  requiredMissing: z.array(z.string().max(420)).max(30),
  ok: z.boolean(),
});

export const brandRulesEnforcer = defineSkill({
  key: "brand-rules-enforcer",
  version: "1.0.0",
  goal: "Pure-code verification that the script obeys the channel DNA rules: forbidden terms banned, required elements present.",
  kind: "code",
  path: "any",
  stages: ["S3", "S8"],
  input: Input,
  output: Output,
  checklist: [
    "forbidden terms (quoted or after ':') are case-insensitively banned from script and title",
    "required terms must appear in script or title",
    "violations quote the exact offending passage as evidence",
    "ok = no hard violation and nothing required missing",
  ],
  examples: [
    {
      name: "banned-word-present",
      input: {
        script: "احصل على هذا العرض المجاني اليوم وبأفضل سعر.",
        rules: [{ id: "r1", text: "ممنوع استخدام كلمة «المجاني»", kind: "forbidden", source: "instruction", hard: true }],
      },
      expectOutput: { ok: false },
    },
    {
      name: "clean",
      input: { script: "سعر عادل وجودة تستحق.", rules: [{ id: "r1", text: "ممنوع كلمة «المجاني»", kind: "forbidden", source: "instruction", hard: true }] },
      expectOutput: { ok: true },
    },
  ],
  implemented: true,
  async run(_rt, input) {
    const haystack = `${input.title ?? ""}\n${input.script}`;
    const hay = haystack.toLowerCase();
    const violations: Array<z.infer<typeof Output>["violations"][number]> = [];
    const requiredMissing: string[] = [];
    /** case-insensitive literal search — no RegExp, so no ReDoS surface */
    const find = (term: string): number => {
      const needle = term.trim().toLowerCase();
      return needle ? hay.indexOf(needle) : -1;
    };

    for (const rule of input.rules) {
      const terms = extractTerms(rule.text);
      if (rule.kind === "forbidden") {
        for (const term of terms) {
          const idx = find(term);
          if (idx >= 0) {
            const at = Math.max(0, idx - 30);
            violations.push({
              ruleId: rule.id,
              ruleText: rule.text,
              evidence: haystack.slice(at, idx + term.length + 30).replace(/\s+/g, " ").trim(),
              hard: rule.hard,
            });
          }
        }
        // forbidden rule whose terms could not be parsed: fall back to the raw tail after ':'
        if (terms.length === 0) {
          const fallback = rule.text.split(/[:：]/).slice(1).join(":").trim();
          if (fallback.length >= 2 && fallback.length <= 60 && find(fallback) >= 0) {
            violations.push({ ruleId: rule.id, ruleText: rule.text, evidence: fallback, hard: rule.hard });
          }
        }
      }
      if (rule.kind === "required") {
        for (const term of terms) {
          if (find(term) < 0) requiredMissing.push(rule.text);
        }
      }
    }

    return { violations, requiredMissing, ok: !violations.some((v) => v.hard) && requiredMissing.length === 0 };
  },
});
