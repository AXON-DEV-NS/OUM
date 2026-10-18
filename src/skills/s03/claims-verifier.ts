import { z } from "zod";
import { ClaimSchema } from "@/src/pipeline/schemas/script";
import { defineSkill } from "@/src/skills/_types";
import { jsonPayload, rolePrompt, runJudge } from "@/src/skills/_common";

export const Input = z.strictObject({
  claims: z.array(ClaimSchema).max(30),
  /** family that wrote the script — the judge MUST differ */
  writerFamily: z.string().min(2).max(20),
});

export const Output = z.strictObject({
  verdicts: z
    .array(
      z.strictObject({
        index: z.number().int().min(0).max(29),
        supported: z.enum(["yes", "no", "unknown"]),
        reason: z.string().max(300),
        sourceUrl: z.string().max(2048).optional(),
      }),
    )
    .max(30),
  judgeFamily: z.string().min(2).max(20),
  judgeModel: z.string().min(2).max(120),
});

/** TRIAGE (wave 1): the verifier judges whether each needs-source claim is
 *  phrased so it can be verified, and flags unsupported ones. It never invents
 *  a source URL: sourceUrl is only echoed when the claim already cites one. */
export const claimsVerifier = defineSkill({
  key: "claims-verifier",
  version: "1.0.0",
  goal: "Independent (different model family) audit of extracted claims: which are supportable, which must be softened or sourced.",
  kind: "llm",
  path: "any",
  stages: ["S3"],
  judge: true,
  input: Input,
  output: Output,
  checklist: [
    "judge family differs from writerFamily (enforced by runJudge)",
    "a claim with an existing sourceUrl can be marked yes",
    "without evidence, supported=unknown and reason explains what proof is needed",
    "never fabricate a source URL",
  ],
  examples: [
    {
      name: "stat-needs-proof",
      input: { claims: [{ text: "٧٠٪ من المستخدمين يعانون من سخونة الهاتف", kind: "statistic", needsSource: true }], writerFamily: "deepseek" },
    },
  ],
  implemented: true,
  async run(rt, input) {
    const system = rolePrompt(
      "You are an adversarial fact-checker. For each claim: supported=yes ONLY if the claim itself cites a credible source (sourceUrl present); " +
        "supported=no if it is provably impossible/generic clickbait phrasing; otherwise unknown with a reason stating exactly what evidence is needed. " +
        "NEVER invent a URL. Echo sourceUrl only when the claim already has one.",
      Output,
    );
    const { data, judgeFamily, judgeModel } = await runJudge<z.infer<typeof Output>>(rt, "claims-verifier", input.writerFamily, {
      system,
      user: `Audit these claims:\n${jsonPayload({ claims: input.claims })}`,
      schema: Output,
      temperature: 0.2,
    });
    return { ...data, judgeFamily, judgeModel };
  },
});
