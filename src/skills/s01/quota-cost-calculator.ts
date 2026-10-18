import { z } from "zod";
import { defineSkill } from "@/src/skills/_types";

export const Input = z.strictObject({
  costCapCents: z.number().int(),
  spentCents: z.number().int().min(0),
  /** tier floors the run will still need to cross (from guards/tier) */
  upcomingFloors: z.array(z.strictObject({ tier: z.string().max(20), floorCents: z.number().int().min(0) })).max(6),
});

export const Output = z.strictObject({
  affordable: z.boolean(),
  totalFloorCents: z.number().int(),
  remainingCents: z.number().int(),
  verdict: z.string().max(400),
});

export const quotaCostCalculator = defineSkill({
  key: "quota-cost-calculator",
  version: "1.0.0",
  goal: "Check, before any spending, that the run's budget cap covers the known floors of the remaining cost tiers.",
  kind: "code",
  path: "any",
  stages: ["S1"],
  input: Input,
  output: Output,
  checklist: [
    "totalFloorCents = sum of upcoming tier floors",
    "affordable only when spent + total floors <= cap",
    "verdict names the exact shortfall in cents",
  ],
  examples: [
    { name: "enough", input: { costCapCents: 1500, spentCents: 0, upcomingFloors: [{ tier: "text", floorCents: 1 }, { tier: "video", floorCents: 260 }] }, expectOutput: { affordable: true, totalFloorCents: 261 } },
    { name: "short", input: { costCapCents: 100, spentCents: 0, upcomingFloors: [{ tier: "video", floorCents: 260 }] }, expectOutput: { affordable: false } },
  ],
  implemented: true,
  async run(_rt, input) {
    const totalFloorCents = input.upcomingFloors.reduce((s, f) => s + f.floorCents, 0);
    const remainingCents = input.costCapCents - input.spentCents;
    const affordable = remainingCents >= totalFloorCents;
    const verdict = affordable
      ? `الميزانية تكفي: متبقٍ ${remainingCents}c مقابل حد أدنى ${totalFloorCents}c للمراحل القادمة`
      : `الميزانية لا تكفي: متبقٍ ${remainingCents}c أقل من ${totalFloorCents}c المطلوبة للمراحل القادمة — ارفع السقف بمقدار ${totalFloorCents - remainingCents}c`;
    return { affordable, totalFloorCents, remainingCents, verdict };
  },
});
