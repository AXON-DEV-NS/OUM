/**
 * Deterministic checks + tier guard unit tests. These are the code gates that
 * everything else trusts — they must fail exactly when they should.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { runChecks } from "@/src/pipeline/checks";
import {
  checkAgainstArchive,
  checkDescription,
  checkHooks,
  checkScriptText,
  checkTags,
  checkTitle,
  countWords,
  duplicateParagraphs,
  findMarkers,
  similarity,
} from "@/src/pipeline/checks/text";
import { checkTierEntry } from "@/src/pipeline/guards/tier";
import { STAGE_BY_KEY } from "@/src/pipeline/stages";
import type { RunRecord, StageRecord } from "@/src/pipeline/store";
import { TEST_SCRIPT } from "./fixtures";

const run = (over: Partial<RunRecord> = {}): RunRecord => ({
  id: "run_1",
  userId: "user_test",
  channelId: "chan_test",
  nicheKey: "tech",
  path: "FACELESS",
  mode: "COPILOT",
  status: "RUNNING",
  currentStage: 0,
  costCapCents: 1500,
  costSpentCents: 0,
  locale: "ar-EG",
  scheduledFor: null,
  lastError: null,
  createdAt: new Date("2026-01-05T10:00:00Z"),
  updatedAt: new Date("2026-01-05T10:00:00Z"),
  ...over,
});

const stage = (over: Partial<StageRecord> = {}): StageRecord => ({
  id: "stage_1",
  runId: "run_1",
  stageKey: "S0",
  index: 0,
  status: "PASSED",
  attempts: 0,
  checkpoint: {},
  input: null,
  output: null,
  score: null,
  skillVersions: null,
  error: null,
  startedAt: null,
  finishedAt: null,
  durationMs: null,
  ...over,
});

const stageChain = (upto: number, overrides: Record<string, Partial<StageRecord>> = {}): StageRecord[] =>
  Array.from({ length: upto }, (_, i) =>
    stage({ stageKey: `S${i}`, index: i, ...(overrides[`S${i}`] ?? {}) }),
  );

describe("text checks", () => {
  test("title: enforces length bounds and rejects placeholders", async () => {
    assert.equal((await checkTitle.run({ title: "عنوان متوسط الطول" })).pass, true);
    assert.equal((await checkTitle.run({ title: "قصير" })).pass, false);
    assert.equal((await checkTitle.run({ title: "todo pending title" })).pass, false);
  });

  test("description: minimum length", async () => {
    assert.equal((await checkDescription.run({ description: "قصير جداً" })).pass, false);
    assert.equal((await checkDescription.run({ description: "و".repeat(90) })).pass, true);
  });

  test("tags: total characters stay under the limit", async () => {
    assert.equal((await checkTags.run({ tags: ["بطارية", "هاتف"] })).pass, true);
    const heavy = Array.from({ length: 9 }, (_, i) => `تاق طويل جداً رقم ${i}`.padEnd(60, "ـ"));
    assert.equal((await checkTags.run({ tags: heavy })).pass, false);
  });

  test("hooks: at least 3, distinct angles", async () => {
    assert.equal((await checkHooks.run({ hooks: ["خطاف أول طويل بما يكفي", "خطاف ثانٍ مختلف تماماً"] })).pass, false);
    const similar = ["هذا خطاف تجريبي طويل بما يكفي تماماً", "هذا خطاف تجريبي طويل بما يكفي جداً", "هذا خطاف تجريبي طويل بما يكفي كذلك"];
    assert.equal((await checkHooks.run({ hooks: similar })).pass, false);
    assert.equal(
      (
        await checkHooks.run({
          hooks: ["هاتفك بيسخن لما تشحنه؟ السبب مش اللي بتظنه.", "ثلاث عادات صغيرة بتقصر عمر بطاريتك.", "قبل أن تتلف بطاريتك.. افعل هذا فوراً."],
        })
      ).pass,
      true,
    );
  });

  test("script: word floor, placeholder scan, duplicated paragraphs", async () => {
    assert.equal((await checkScriptText.run({ script: "كلمات قليلة فقط" })).pass, false);

    const sentence = "هذا النص التجريبي يحتوي كلمات كثيرة ومتنوعة لاختبار التكرار داخل السكربت بالكامل وكذلك نتحقق منه";
    const duplicated = Array.from({ length: 8 }, () => sentence).join("\n\n");
    assert.ok(duplicateParagraphs(duplicated) > 0);
    const out = await checkScriptText.run({ script: duplicated });
    assert.equal(out.pass, false);
    assert.match(String(out.message), /duplicated/);

    assert.equal((await checkScriptText.run({ script: TEST_SCRIPT, targetMinutes: 3 })).pass, true);
  });

  test("archive similarity blocks near-duplicates and passes on empty archives", async () => {
    const corpus = [TEST_SCRIPT];
    const nearDup = await checkAgainstArchive(() => corpus).run({ text: TEST_SCRIPT });
    assert.equal(nearDup.pass, false);
    assert.ok(similarity(TEST_SCRIPT, TEST_SCRIPT) > 0.99);

    const empty = await checkAgainstArchive(() => []).run({ text: TEST_SCRIPT });
    assert.equal(empty.pass, true);
    assert.equal(empty.skipped, undefined);
  });

  test("helpers: markers and word counting", () => {
    assert.deepEqual(findMarkers("hello TODO world"), ["todo"]);
    assert.equal(countWords("كلمةٌ وكلمتان والعربيةُ جميلة"), 4);
  });

  test("runChecks aggregates heterogeneous checks and scores them", async () => {
    const summary = await runChecks([checkTitle, checkTags] as Parameters<typeof runChecks>[0], {
      title: "عنوان سليم الطول",
      tags: ["بطارية"],
    } as never);
    assert.equal(summary.pass, true);
    assert.equal(summary.score, 100);
    assert.equal(summary.outcomes.length, 2);

    const failing = await runChecks([checkTitle, checkTags] as Parameters<typeof runChecks>[0], {
      title: "قصير",
      tags: ["بطارية"],
    } as never);
    assert.equal(failing.pass, false);
    assert.equal(failing.failed.length, 1);
    assert.ok(failing.score < 100);
  });
});

describe("tier guard", () => {
  test("publish requires S8 >= passScore and a passed S9", () => {
    const def = STAGE_BY_KEY.S10;
    const good = stageChain(10, {
      S8: { stageKey: "S8", score: 95, status: "PASSED" },
      S9: { stageKey: "S9", status: "PASSED" },
    });
    assert.equal(checkTierEntry(def, good, run()).pass, true);

    const lowScore = stageChain(10, {
      S8: { stageKey: "S8", score: 60, status: "PASSED" },
      S9: { stageKey: "S9", status: "PASSED" },
    });
    const r1 = checkTierEntry(def, lowScore, run());
    assert.equal(r1.pass, false);
    assert.equal(r1.code, "GATE_BLOCKED");

    // explicit human override (_forced) passes a low QA score
    const forced = stageChain(10, {
      S8: { stageKey: "S8", score: 60, status: "PASSED", checkpoint: { _forced: true } },
      S9: { stageKey: "S9", status: "PASSED" },
    });
    assert.equal(checkTierEntry(def, forced, run()).pass, true);

    const noApproval = stageChain(10, {
      S8: { stageKey: "S8", score: 95, status: "PASSED" },
      S9: { stageKey: "S9", status: "WAITING" },
    });
    assert.equal(checkTierEntry(def, noApproval, run()).code, "GATE_BLOCKED");
  });

  test("budget floors stop obviously-doomed tiers", () => {
    const def = STAGE_BY_KEY.S6; // video tier, floor 260c
    const prior = stageChain(6);
    const broke = checkTierEntry(def, prior, run({ costCapCents: 1000, costSpentCents: 800 }));
    assert.equal(broke.pass, false);
    assert.equal(broke.code, "BUDGET_EXCEEDED");
    assert.equal(checkTierEntry(def, prior, run({ costCapCents: 1000, costSpentCents: 700 })).pass, true);
  });

  test("earlier stages must be passed before any later tier runs", () => {
    const def = STAGE_BY_KEY.S6;
    const broken = stageChain(6, { S4: { stageKey: "S4", index: 4, status: "FAILED" } });
    const r = checkTierEntry(def, broken, run());
    assert.equal(r.pass, false);
    assert.equal(r.code, "GATE_BLOCKED");
  });
});
