/**
 * End-to-end engine tests on the REAL stages, checks, guards and stores with
 * stub providers only (LLM / media / YouTube / page fetch).
 *
 * Covered:
 *   1. the full FACELESS run: S0 approval -> S9 approval -> private-first
 *      publish -> post-publish timeline -> DONE
 *   2. provider holds park cheaply and self-heal when a key appears
 *   3. judge holds never auto-resume; a human resume unblocks them
 *   4. the pre-flight budget gate stops a run before any media spend
 *   5. the tier guard stops mid-run overspend before video-tier money
 *   6. the auto-fix loop rewinds to the fixStage and fails after maxFixRetries
 *   7. human rejection tags the run (learning-loop input)
 *   8. a missing media provider parks S5 and self-heals via tick()
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { setupPipeline } from "./fixtures";
import { StubMedia } from "@/src/pipeline/providers/stub-media";
import { callsByPurpose } from "@/src/pipeline/providers/stub-llm";
import type { AuditInput } from "@/src/pipeline/store";
import type { StageHold } from "@/src/pipeline/stage";

const holdOf = (checkpoint: unknown): StageHold =>
  (checkpoint as { _hold?: StageHold })._hold ?? { kind: "gate", reason: "missing" };

describe("pipeline engine — end to end", () => {
  test("full FACELESS run reaches DONE through every gate", async () => {
    const h = setupPipeline();
    const run = await h.createRun();

    // ── S0 parks for the client's DNA approval ──
    let last = (await h.engine.run(run.id, 40)).last;
    assert.equal(last.kind, "held");
    assert.equal(last.kind === "held" ? last.stage : "", "S0");

    await h.engine.decide(run.id, "approve", { actorId: "user_test" });

    // ── S1..S8: research, script, storyboard, assets, render, SEO, QA2/QA3 ──
    last = (await h.engine.run(run.id, 40)).last;
    assert.equal(last.kind, "held");
    assert.equal(last.kind === "held" ? last.stage : "", "S9");

    const s8 = await h.store.getStage(run.id, "S8");
    assert.equal(s8?.status, "PASSED");
    assert.equal(s8?.score, 95); // det 100 * 0.5 + judges 90 * 0.5

    // QA rows carry judge/writer provenance: judge family != writer family
    const judgeRows = (await h.store.listQa(run.id)).filter((q) => q.kind === "judge");
    assert.equal(judgeRows.length, 3);
    for (const row of judgeRows) {
      assert.equal(row.writerModel, "deepseek");
      assert.equal(row.judgeModel, "stub-openai");
      assert.notEqual(row.judgeModel, row.writerModel, "judge must not be the writer");
      assert.equal(row.passed, true);
    }

    await h.engine.decide(run.id, "approve", { actorId: "user_test" });

    // ── S10: upload PRIVATE first, schedule, park until the slot ──
    last = (await h.engine.run(run.id, 40)).last;
    assert.equal(last.kind, "waiting");
    assert.equal(last.kind === "waiting" ? last.stage : "", "S10");
    assert.ok(last.kind === "waiting" && last.wakeAtIso, "S10 must park with a wake instant");
    assert.deepEqual(h.youtube.calls, ["upload:stubvid1", "schedule:stubvid1"]);
    assert.equal(h.youtube.uploads.get("stubvid1")?.privacy, "private");

    // ── post-publish timeline: p10m / p2h / p48h / p7d by moving the clock ──
    for (let guard = 0; guard < 12; guard++) {
      const current = await h.store.getRun(run.id);
      if (!current || current.status === "DONE") break;
      if (current.scheduledFor) {
        h.clock.set(current.scheduledFor.toISOString());
        h.clock.advanceMs(2000);
        await h.engine.tick();
        continue;
      }
      const step = (await h.engine.run(run.id, 40)).last;
      if (step.kind === "completed") break;
      if (step.kind === "waiting" && step.wakeAtIso) {
        h.clock.set(step.wakeAtIso);
        h.clock.advanceMs(2000);
      }
    }

    const finalRun = await h.store.getRun(run.id);
    assert.equal(finalRun?.status, "DONE");

    const stages = await h.store.listStages(run.id);
    assert.equal(stages.length, 13);
    for (const s of stages) {
      assert.ok(["PASSED", "SKIPPED"].includes(s.status), `${s.stageKey}: ${s.status}`);
    }

    const s11 = stages.find((s) => s.stageKey === "S11");
    const s11out = s11?.output as { done?: string[] } | undefined;
    assert.deepEqual(s11out?.done?.slice().sort(), ["p10m", "p2h", "p48h", "p7d"]);

    // ── money honesty: ledger total == run total, video tier really paid ──
    const ledger = await h.store.ledgerTotal(run.id);
    assert.equal(finalRun?.costSpentCents, ledger);
    assert.ok(ledger > 0, "the run must have spent something");

    // ── media really ran: 8 images + voice + render ──
    const calls = h.media.calls;
    assert.equal(calls.filter((c) => c.method === "generateImage").length, 8);
    assert.equal(calls.filter((c) => c.method === "synthesizeVoice").length, 1);
    assert.equal(calls.filter((c) => c.method === "render").length, 1);

    // ── S5 assets point to files that exist on disk ──
    const images = (await h.store.listAssets(run.id)).filter((a) => a.kind === "image");
    assert.equal(images.length, 8);
    for (const img of images) {
      assert.ok(img.filePath && existsSync(img.filePath), String(img.filePath));
    }

    // ── the learning loop recorded a lesson for the niche ──
    assert.equal((await h.store.listLessons("tech")).length, 1);

    // ── notifications cover both human gates, publication and the finish ──
    const kinds = h.notifications.map((n) => n.kind);
    assert.ok(kinds.includes("approval_needed"));
    assert.ok(kinds.includes("published"));
    assert.ok(kinds.includes("run_done"));

    // ── every human decision is audit-logged ──
    const audits = (h.store as unknown as { audits: AuditInput[] }).audits;
    const approveAudits = audits.filter((a) => a.action === "pipeline:approve");
    assert.equal(approveAudits.length, 2);
    assert.equal(approveAudits[0]?.actorId, "user_test");
  });

  test("missing LLM provider parks S0 cheaply and self-heals via tick", async () => {
    const h = setupPipeline({ families: [] });
    const run = await h.createRun();

    const last = (await h.engine.run(run.id, 5)).last;
    assert.equal(last.kind, "waiting");
    assert.equal(last.kind === "waiting" ? last.stage : "", "S0");
    assert.equal(last.kind === "waiting" ? last.hold.kind : "", "provider");
    assert.equal(await h.store.ledgerTotal(run.id), 0, "nothing may be spent without a provider");

    // a key appears -> the SAME stored state resumes itself on the next tick
    const engine2 = h.makeEngine({ families: ["deepseek", "openai"] });
    const summary = await engine2.tick();
    assert.deepEqual(summary.resumed, [run.id]);

    const s0 = await h.store.getStage(run.id, "S0");
    assert.equal(s0?.status, "WAITING"); // now parked for the human, not the provider
    assert.equal((s0?.checkpoint as { _human?: boolean })._human, true);
  });

  test("judge holds never auto-resume; a human resume unblocks them", async () => {
    const h = setupPipeline({ families: ["deepseek"] });
    const run = await h.createRun();

    let last = (await h.engine.run(run.id, 40)).last;
    assert.equal(last.kind, "held"); // S0 approval
    await h.engine.decide(run.id, "approve", { actorId: "user_test" });

    last = (await h.engine.run(run.id, 40)).last;
    assert.equal(last.kind, "waiting");
    assert.equal(last.kind === "waiting" ? last.stage : "", "S3");
    assert.equal(last.kind === "waiting" ? last.hold.kind : "", "judge");
    assert.equal((await h.store.getStage(run.id, "S3"))?.status, "WAITING");

    // a second family arriving does NOT auto-resume a judge hold
    const engine2 = h.makeEngine({ families: ["deepseek", "openai"] });
    await engine2.tick();
    assert.equal((await h.store.getRun(run.id))?.status, "HOLD");

    // an explicit human resume unblocks it
    await engine2.decide(run.id, "resume", { actorId: "user_test", reason: "أُضيف مفتاح العائلة الثانية" });
    last = (await engine2.run(run.id, 40)).last;
    assert.equal(last.kind, "held");
    assert.equal(last.kind === "held" ? last.stage : "", "S9");
    assert.equal((await h.store.getStage(run.id, "S3"))?.status, "PASSED");
  });

  test("pre-flight budget gate stops the run before any media spend", async () => {
    const h = setupPipeline();
    const run = await h.createRun(250); // below the 301c tier floors

    let last = (await h.engine.run(run.id, 40)).last;
    assert.equal(last.kind, "held"); // S0 approval
    await h.engine.decide(run.id, "approve", { actorId: "user_test" });

    last = (await h.engine.run(run.id, 40)).last;
    assert.equal(last.kind, "held");
    assert.equal(last.kind === "held" ? last.stage : "", "S1");
    assert.equal(last.kind === "held" ? last.hold.kind : "", "budget");
    assert.equal(h.media.calls.length, 0);
    assert.deepEqual(h.youtube.calls, []);
  });

  test("tier guard stops mid-run overspend before video-tier money", async () => {
    const h = setupPipeline();
    // deliberately expensive stub tokens: the cap is consumed by text stages
    const engine = h.makeEngine({ llmInTokens: 326_000 });
    const run = await h.createRun(520);

    let last = (await engine.run(run.id, 40)).last;
    assert.equal(last.kind, "held"); // S0 approval
    await engine.decide(run.id, "approve", { actorId: "user_test" });

    last = (await engine.run(run.id, 60)).last;
    assert.equal(last.kind, "held");
    assert.equal(last.kind === "held" ? last.hold.kind : "", "budget");
    const stoppedAt = last.kind === "held" ? last.stage : "";
    assert.ok(["S3", "S4", "S5", "S6"].includes(stoppedAt), `stopped at ${stoppedAt}`);
    assert.equal(h.media.calls.length, 0, "no image/video money may be spent");
  });

  test("auto-fix loop rewinds to the fixStage and fails after maxFixRetries", async () => {
    const h = setupPipeline({ rejectPromise: true });
    const run = await h.createRun();

    let last = (await h.engine.run(run.id, 40)).last;
    assert.equal(last.kind, "held"); // S0 approval
    await h.engine.decide(run.id, "approve", { actorId: "user_test" });

    // round 1: judge rejects -> rewind to S7
    last = (await h.engine.run(run.id, 60)).last;
    assert.equal(last.kind, "retrying");
    assert.equal(last.kind === "retrying" ? last.stage : "", "S8");
    assert.equal(last.kind === "retrying" ? last.to : "", "S7");
    let s8 = await h.store.getStage(run.id, "S8");
    assert.equal((s8?.checkpoint as { _fixRounds?: number })._fixRounds, 1);
    // the rewind reset S7..S12 to PENDING; S7 re-runs on the next run() call
    assert.equal((await h.store.getStage(run.id, "S7"))?.status, "PENDING");

    // round 2
    last = (await h.engine.run(run.id, 60)).last;
    assert.equal(last.kind, "retrying");
    s8 = await h.store.getStage(run.id, "S8");
    assert.equal((s8?.checkpoint as { _fixRounds?: number })._fixRounds, 2);

    // round 3 exceeds maxFixRetries (2) -> FAILED
    last = (await h.engine.run(run.id, 60)).last;
    assert.equal(last.kind, "failed");
    assert.equal(last.kind === "failed" ? last.stage : "", "S8");
    const s8final = await h.store.getStage(run.id, "S8");
    assert.equal(s8final?.status, "FAILED");
    // the failure message records the exhausted budget (maxFixRetries = 2)
    assert.match(String(s8final?.error), /جولات الإصلاح \(2\)/);
    // the checkpoint keeps the counting from the last rewind round
    assert.equal((s8final?.checkpoint as { _fixRounds?: number })._fixRounds, 2);
    assert.equal((await h.store.getRun(run.id))?.status, "FAILED");

    // S7 really re-ran once per round (3 executions total)
    assert.equal(callsByPurpose(h.llms[0])["title-lab"], 3);
  });

  test("human rejection tags the run for the learning loop", async () => {
    const h = setupPipeline();
    const run = await h.createRun();

    await h.engine.run(run.id, 5); // S0 parked
    const out = await h.engine.decide(run.id, "reject", {
      actorId: "user_test",
      reason: "العنوان ضعيف والمقدمة لا تشد المشاهد",
    });
    assert.equal(out.kind, "failed");
    assert.equal((await h.store.getRun(run.id))?.status, "FAILED");

    const s0 = await h.store.getStage(run.id, "S0");
    const rejection = (s0?.checkpoint as { rejection?: { reason?: string; tags?: string[] } }).rejection;
    assert.equal(rejection?.reason, "العنوان ضعيف والمقدمة لا تشد المشاهد");
    assert.ok(rejection?.tags?.includes("hook"), JSON.stringify(rejection?.tags));
    assert.ok(rejection?.tags?.includes("title"), JSON.stringify(rejection?.tags));
  });

  test("missing media provider parks S5 and self-heals via tick", async () => {
    const h = setupPipeline({ mediaConfigured: false });
    const run = await h.createRun();

    let last = (await h.engine.run(run.id, 40)).last;
    assert.equal(last.kind, "held"); // S0 approval
    await h.engine.decide(run.id, "approve", { actorId: "user_test" });

    last = (await h.engine.run(run.id, 60)).last;
    assert.equal(last.kind, "waiting");
    assert.equal(last.kind === "waiting" ? last.stage : "", "S5");
    assert.equal(last.kind === "waiting" ? last.hold.kind : "", "provider");
    assert.equal(holdOf((await h.store.getStage(run.id, "S5"))?.checkpoint).kind, "provider");

    // generation keys appear -> provider hold self-heals on the next tick
    const media2 = new StubMedia({ configured: true, costCentsPerAsset: 1, filePathPrefix: "/tmp/opencode/oum-stub-tests-2" });
    const engine2 = h.makeEngine({ media: media2 });
    const summary = await engine2.tick();
    assert.deepEqual(summary.resumed, [run.id]);
    assert.equal(media2.calls.filter((c) => c.method === "generateImage").length, 8);
    assert.equal((await h.store.getStage(run.id, "S5"))?.status, "PASSED");
    assert.equal(h.media.calls.length, 0, "the unconfigured provider was never called");
  });
});
