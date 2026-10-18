import { z } from "zod";
import { RuleConflictSchema, RuleSchema } from "@/src/pipeline/schemas/dna";
import { defineSkill } from "@/src/skills/_types";
import { similarity } from "@/src/pipeline/checks/text";

export const Input = z.strictObject({ rules: z.array(RuleSchema).min(1).max(120) });

export const Output = z.strictObject({
  conflicts: z.array(RuleConflictSchema).max(30),
  cleaned: z.array(RuleSchema).max(120),
  droppedDuplicates: z.number().int().min(0).max(120),
});

/** pull the concrete terms a rule talks about: «quoted» terms + "term: value" tails */
export function extractTerms(text: string): string[] {
  const terms: string[] = [];
  for (const m of text.matchAll(/[«"']([^«»"']{2,60})[»"']/g)) terms.push(m[1].trim());
  const tail = text.split(/[:=]/).slice(1).join(":").trim();
  if (tail.length >= 2 && tail.length <= 60 && terms.length === 0) terms.push(tail);
  return terms;
}

export const conflictDetector = defineSkill({
  key: "conflict-detector",
  version: "1.0.0",
  goal: "Pure-code scan of compiled rules: find forbidden/required contradictions and near-duplicate rules.",
  kind: "code",
  path: "any",
  stages: ["S0"],
  input: Input,
  output: Output,
  checklist: [
    "a term required by one rule and forbidden by another is flagged high",
    "near-duplicate rules (>80% similar text) are flagged low and dropped from cleaned",
    "no rule text is mutated — only removals are reported",
  ],
  examples: [
    {
      name: "forbidden-vs-required",
      input: {
        rules: [
          { id: "r1", text: "لا تستخدم كلمة «مجاناً» في أي وصف", kind: "forbidden", source: "instruction", hard: true },
          { id: "r2", text: "العنصر: مجاناً", kind: "required", source: "instruction", hard: true },
        ],
      },
      expectOutput: { droppedDuplicates: 0 },
    },
  ],
  implemented: true,
  async run(_rt, input) {
    const conflicts: Array<z.infer<typeof RuleConflictSchema>> = [];
    const cleaned: Array<z.infer<typeof RuleSchema>> = [];
    let droppedDuplicates = 0;

    for (const rule of input.rules) {
      const dupOf = cleaned.find((c) => c.kind === rule.kind && similarity(c.text, rule.text) > 0.8);
      if (dupOf) {
        droppedDuplicates++;
        conflicts.push({ a: rule.id, b: dupOf.id, severity: "low", resolution: `dropped duplicate rule ${rule.id}` });
        continue;
      }
      cleaned.push(rule);
    }

    const forbidden = cleaned.filter((r) => r.kind === "forbidden");
    const required = cleaned.filter((r) => r.kind === "required");
    for (const req of required) {
      for (const term of extractTerms(req.text)) {
        for (const forb of forbidden) {
          for (const bad of extractTerms(forb.text)) {
            const t = term.toLowerCase();
            const b = bad.toLowerCase();
            if (t === b || t.includes(b) || b.includes(t)) {
              conflicts.push({
                a: req.id,
                b: forb.id,
                severity: "high",
                resolution: `remove the term «${term}» from the required rule or lift the ban in ${forb.id}`,
              });
            }
          }
        }
      }
    }

    return { conflicts, cleaned, droppedDuplicates };
  },
});
