/**
 * THE ENGINE — the only component allowed to move a run between stages.
 *
 * Guarantees (all enforced in code, none of them by an LLM):
 *   1. Tier order: a stage never runs before every earlier stage passed
 *      (Fail Early: text < image < video < publish).
 *   2. Paid-stage gates run BEFORE locking/executing — missing providers,
 *      missing judge families and missing budget park the run (HOLD) without
 *      spending a cent more.
 *   3. Every executed stage is validate()d by deterministic checks; failures
 *      either retry the same stage (bounded by maxAttempts) or REWIND to the
 *      fixStage named by the check (bounded by CONFIG.qa.maxFixRetries).
 *      Media checkpoints survive rewinds, so rewinds never re-pay for images,
 *      voice or renders already produced.
 *   4. Holds carry a machine-readable kind: timing/provider holds auto-resume
 *      through tick(); budget/qa/gate holds wait for a human decision().
 *   5. QA rows are written for every failure/warning and for judge verdicts —
 *      stage S12 learns only from recorded evidence.
 */
import { CONFIG } from "./config";
import { toPipelineError, type PipelineError } from "./errors";
import { CostGuard } from "./guards/cost";
import { checkTierEntry } from "./guards/tier";
import { STAGE_KEYS, type StageContext, type StageDefinition, type StageHold, type StageKey } from "./stage";
import { STAGES, STAGE_BY_KEY } from "./stages";
import { skillsForStage, skillVersions } from "@/src/skills/loader";
import { executeSkill, type SkillRuntime } from "@/src/skills/_types";
import { rejectionTagger } from "@/src/skills/s09/rejection-tagger";
import type { CheckOutcome } from "./checks";
import type { PipelineStore, RunRecord, StageRecord } from "./store";
import type { LlmGateway, MediaGateway, NotifierFn, PageSnapshot, YoutubeGateway } from "./providers/types";

export interface EngineDeps {
  store: PipelineStore;
  llm: LlmGateway;
  media: MediaGateway;
  youtube: YoutubeGateway;
  notify: NotifierFn;
  fetchPage: (url: string) => Promise<PageSnapshot>;
  now?: () => Date;
  /** RUNNING stages older than this are considered crashed (default 15 min) */
  staleMinutes?: number;
}

export type AdvanceOutcome =
  | { kind: "advanced"; stage: StageKey; score?: number }
  | { kind: "retrying"; stage: StageKey; reason: string; to?: StageKey }
  | { kind: "waiting"; stage: StageKey; hold: StageHold; wakeAtIso?: string }
  | { kind: "held"; stage: StageKey; hold: StageHold }
  | { kind: "failed"; stage: StageKey | null; reason: string }
  | { kind: "completed" }
  | { kind: "idle"; reason?: string };

export type Decision = "approve" | "reject" | "resume" | "retry";

export interface DecideOptions {
  actorId: string;
  reason?: string;
  /** "retry" only: rewind to this earlier stage (defaults to the current one) */
  toStage?: StageKey;
  note?: string;
}

export interface TickSummary {
  recovered: string[];
  resumed: string[];
  cycled: string[];
  outcomes: Record<string, number>;
}

const HOLD_KIND_BY_CODE: Record<string, StageHold["kind"]> = {
  PROVIDER_MISSING: "provider",
  NOT_CONFIGURED: "provider",
  JUDGE_UNAVAILABLE: "judge",
  BUDGET_EXCEEDED: "budget",
  GATE_BLOCKED: "gate",
  IDEMPOTENCY_CONFLICT: "gate",
};

function bump(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

export class PipelineEngine {
  private cost: CostGuard;

  constructor(private deps: EngineDeps) {
    this.cost = new CostGuard(deps.store);
  }

  private now(): Date {
    return this.deps.now ? this.deps.now() : new Date();
  }

  // ── public API ─────────────────────────────────────────────────

  /**
   * Execute ONE stage transition (or report the current boundary).
   * Use run() to drive a run until it parks/completes.
   */
  async advance(runId: string): Promise<AdvanceOutcome> {
    const store = this.deps.store;
    let run = await store.getRun(runId);
    if (!run) return { kind: "idle", reason: `run ${runId} not found` };
    if (run.status === "DONE") return { kind: "completed" };
    if (run.status === "FAILED") return { kind: "failed", stage: await this.parkedStageKey(runId), reason: run.lastError ?? "run failed" };
    if (run.status === "HOLD" || run.status === "WAITING_HUMAN") {
      const parked = (await store.listStages(runId)).find((s) => s.status === "WAITING");
      if (!parked) return { kind: "idle", reason: `run ${run.status}` };
      const hold = this.holdOf(parked);
      const kind: AdvanceOutcome["kind"] = hold.kind === "provider" || hold.kind === "judge" ? "waiting" : "held";
      return kind === "waiting"
        ? { kind: "waiting", stage: parked.stageKey as StageKey, hold, wakeAtIso: hold.wakeAtIso }
        : { kind: "held", stage: parked.stageKey as StageKey, hold };
    }
    if (run.status === "QUEUED") run = await store.updateRun(runId, { status: "RUNNING" });

    for (let guard = 0; guard < 40; guard++) {
      const stages = await store.listStages(runId);
      const def = STAGES.find((d) => {
        const row = stages.find((s) => s.stageKey === d.key);
        return !row || (row.status !== "PASSED" && row.status !== "SKIPPED");
      });

      if (!def) {
        await store.updateRun(runId, { status: "DONE", currentStage: STAGES.length, lastError: null, scheduledFor: null });
        await this.notifyOwner(run, "run_done", `اكتملت الرحلة ${runId}`, `كل المراحل الـ13 عبرت بواباتها. الميزانية المنفقة: ${run.costSpentCents}c من ${run.costCapCents}c.`);
        return { kind: "completed" };
      }

      const row = await store.ensureStage(runId, def.key, def.index);
      const entryStatus = row.status;

      // ── parked stage: resume when the blocker is machine-clearable ──
      if (row.status === "WAITING") {
        const hold = this.holdOf(row);
        if (hold.kind === "timing") {
          const wake = hold.wakeAtIso ?? run.scheduledFor?.toISOString();
          if (wake && new Date(wake).getTime() <= this.now().getTime()) {
            await store.updateStage(runId, def.key, { status: "PENDING" });
            run = await store.updateRun(runId, { status: "RUNNING", scheduledFor: null });
            continue;
          }
          return { kind: "waiting", stage: def.key, hold, wakeAtIso: wake };
        }
        if (hold.kind === "provider") {
          // cheap self-heal: re-run the gate now that a key may have appeared
          await store.updateStage(runId, def.key, { status: "PENDING" });
          run = await store.updateRun(runId, { status: "RUNNING" });
          continue;
        }
        return hold.kind === "judge"
          ? { kind: "waiting", stage: def.key, hold }
          : { kind: "held", stage: def.key, hold };
      }

      if (row.status === "FAILED") {
        await store.updateRun(runId, { status: "FAILED", lastError: row.error ?? `stage ${def.key} failed` });
        return { kind: "failed", stage: def.key, reason: row.error ?? "stage failed" };
      }
      if (row.status === "RUNNING") {
        return { kind: "idle", reason: `stage ${def.key} is already running` };
      }

      // ── tier guard (Fail Early) ──
      const tier = checkTierEntry(def, stages, run);
      if (!tier.pass) {
        const hold: StageHold = { kind: tier.code === "BUDGET_EXCEEDED" ? "budget" : "gate", reason: tier.reason ?? "محجوب" };
        await this.holdStage(run, def, row, hold);
        return { kind: "held", stage: def.key, hold };
      }

      // ── stage gate ──
      let ctx = await this.buildContext(run, def, row, stages);
      const gate = await def.gate(ctx);
      if (!gate.pass) {
        const hold: StageHold = {
          kind: gate.code ? HOLD_KIND_BY_CODE[gate.code] ?? "gate" : "gate",
          reason: gate.reason ?? "بوابة المرحلة رفضت الدخول",
        };
        await this.holdStage(run, def, row, hold);
        const auto = hold.kind === "provider" || hold.kind === "judge";
        return auto ? { kind: "waiting", stage: def.key, hold } : { kind: "held", stage: def.key, hold };
      }

      // ── lock (CAS) and execute ──
      const locked = await store.lockStage(runId, def.key, ["PENDING", "RETRY"]);
      if (!locked) continue; // another worker took it; re-read state
      const lockedRow = await store.getStage(runId, def.key);
      if (!lockedRow) return { kind: "idle", reason: "stage row vanished" };
      ctx = await this.buildContext(run, def, lockedRow, stages);
      const startedAt = this.now();

      try {
        const result = await def.execute(ctx);
        const finishedAt = this.now();
        const durationMs = finishedAt.getTime() - startedAt.getTime();
        const score = typeof result.score === "number" ? result.score : null;
        const outcomes: CheckOutcome[] =
          def.validate && !result.hold && !result.requiresHuman ? await def.validate(ctx, result) : [];
        const problems = outcomes.filter((o) => o.severity !== "info" && !o.pass);
        for (const o of problems.slice(0, 25)) {
          await store.addQa({
            runId,
            stageKey: def.key,
            stageRowId: lockedRow.id,
            checkKey: o.key,
            kind: "deterministic",
            passed: false,
            reasons: { message: o.message ?? null, fix: o.fix ?? null },
            action: o.severity === "fail" ? "fail" : "warn",
          });
        }

        // park: explicit hold from the stage
        if (result.hold) {
          const hold = result.hold;
          const checkpoint: Record<string, unknown> = { _hold: hold, _human: null, ...(result.checkpoint ?? {}) };
          const wasParked = entryStatus === "WAITING" && this.holdOf(row).reason === hold.reason;
          await store.updateStage(runId, def.key, { status: "WAITING", checkpoint, output: result.output, ...(score !== null ? { score } : {}), finishedAt, durationMs, error: hold.reason });
          if (hold.kind === "timing" && hold.wakeAtIso) {
            run = await store.updateRun(runId, { status: "RUNNING", scheduledFor: new Date(hold.wakeAtIso) });
            return { kind: "waiting", stage: def.key, hold, wakeAtIso: hold.wakeAtIso };
          }
          run = await store.updateRun(runId, { status: "HOLD", lastError: hold.reason });
          if (!wasParked && hold.kind !== "provider") {
            await this.notifyOwner(run, "run_hold", `الرحلة ${runId} توقفت عند ${def.key}`, hold.reason);
          }
          return hold.kind === "provider" || hold.kind === "judge"
            ? { kind: "waiting", stage: def.key, hold }
            : { kind: "held", stage: def.key, hold };
        }

        // park: human decision required
        if (result.requiresHuman) {
          await store.updateStage(runId, def.key, {
            status: "WAITING",
            checkpoint: { _human: true, ...(result.checkpoint ?? {}) },
            output: result.output,
            ...(score !== null ? { score } : {}),
            finishedAt,
            durationMs,
            error: null,
          });
          run = await store.updateRun(runId, { status: "WAITING_HUMAN", lastError: null });
          return { kind: "held", stage: def.key, hold: { kind: "gate", reason: "بانتظار قرار بشري" } };
        }

        // problems: retry in place, or rewind to the earliest fixStage
        if (result.retry || problems.length > 0) {
          const reason = result.retry?.reason ?? problems[0]?.message ?? "فشل التحقق";
          const fixes =
            result.retry?.fixes ??
            problems.map((o) => ({ text: (o.fix ?? o.message ?? "فحص فاشل").slice(0, 300), stage: o.fixStage as string | undefined }));
          const rewindIndices = fixes
            .map((f) => f.stage)
            .filter((s): s is string => !!s && (STAGE_KEYS as readonly string[]).includes(s))
            .map((s) => STAGE_KEYS.indexOf(s as StageKey))
            .filter((i) => i >= 0 && i < def.index);

          if (rewindIndices.length > 0) {
            const fromIndex = Math.min(...rewindIndices);
            const rounds = Number((lockedRow.checkpoint as { _fixRounds?: number })._fixRounds ?? 0) + 1;
            if (rounds > CONFIG.qa.maxFixRetries) {
              await store.updateStage(runId, def.key, {
                status: "FAILED",
                error: `تجاوزت جولات الإصلاح (${CONFIG.qa.maxFixRetries}) — آخر سبب: ${reason}`,
                output: result.output,
                ...(score !== null ? { score } : {}),
                finishedAt,
                durationMs,
              });
              await store.updateRun(runId, { status: "FAILED", lastError: reason });
              await this.notifyOwner(run, "run_failed", `فشلت الرحلة ${runId} عند ${def.key}`, reason);
              return { kind: "failed", stage: def.key, reason };
            }
            await store.updateStage(runId, def.key, {
              status: "PENDING",
              checkpoint: { _fixRounds: rounds, _lastRetry: reason },
              output: result.output,
              ...(score !== null ? { score } : {}),
              error: reason,
              finishedAt,
              durationMs,
            });
            await store.resetStagesFrom(runId, fromIndex, `إصلاح تلقائي: ${reason}`.slice(0, 300));
            run = await store.updateRun(runId, { status: "RUNNING", lastError: null });
            return { kind: "retrying", stage: def.key, reason, to: STAGE_KEYS[fromIndex] };
          }

          if (lockedRow.attempts >= def.maxAttempts) {
            await store.updateStage(runId, def.key, {
              status: "FAILED",
              error: reason,
              output: result.output,
              ...(score !== null ? { score } : {}),
              finishedAt,
              durationMs,
            });
            await store.updateRun(runId, { status: "FAILED", lastError: reason });
            await this.notifyOwner(run, "run_failed", `فشلت الرحلة ${runId} عند ${def.key} بعد ${lockedRow.attempts} محاولات`, reason);
            return { kind: "failed", stage: def.key, reason };
          }
          await store.updateStage(runId, def.key, {
            status: "RETRY",
            error: reason,
            output: result.output,
            ...(score !== null ? { score } : {}),
            finishedAt,
            durationMs,
          });
          return { kind: "retrying", stage: def.key, reason };
        }

        // success
        await store.updateStage(runId, def.key, {
          status: "PASSED",
          output: result.output,
          ...(score !== null ? { score } : {}),
          checkpoint: result.checkpoint,
          skillVersions: skillVersions(ctx.skills),
          error: null,
          finishedAt,
          durationMs,
        });
        if (def.key === "S10") {
          run = await store.updateRun(runId, { status: "PUBLISHED", currentStage: def.index + 1, lastError: null });
          await this.notifyOwner(run, "published", `نُشر الفيديو — ${runId}`, "تم النشر خصوصي أولاً ثم أصبح عاماً حسب الجدولة. تبدأ فحوص ما بعد النشر.");
        } else {
          run = await store.updateRun(runId, { status: "RUNNING", currentStage: def.index + 1, lastError: null });
        }
        return { kind: "advanced", stage: def.key, score: score ?? undefined };
      } catch (e) {
        const pe = toPipelineError(e);
        const finishedAt = this.now();
        const durationMs = finishedAt.getTime() - startedAt.getTime();
        if (pe.cheap) {
          const hold: StageHold = {
            kind: HOLD_KIND_BY_CODE[pe.code] ?? "gate",
            reason: pe.message,
          };
          await store.updateStage(runId, def.key, { status: "WAITING", checkpoint: { _hold: hold }, error: pe.message, finishedAt, durationMs });
          run = await store.updateRun(runId, { status: "HOLD", lastError: pe.message });
          if (hold.kind !== "provider") {
            await this.notifyOwner(run, "run_hold", `الرحلة ${runId} توقفت عند ${def.key}`, pe.message);
          }
          return hold.kind === "provider" || hold.kind === "judge"
            ? { kind: "waiting", stage: def.key, hold }
            : { kind: "held", stage: def.key, hold };
        }
        if (lockedRow.attempts >= def.maxAttempts) {
          await store.updateStage(runId, def.key, { status: "FAILED", error: pe.message, finishedAt, durationMs });
          await store.updateRun(runId, { status: "FAILED", lastError: pe.message });
          await this.notifyOwner(run, "run_failed", `فشلت الرحلة ${runId} عند ${def.key}`, pe.message);
          return { kind: "failed", stage: def.key, reason: pe.message };
        }
        await store.updateStage(runId, def.key, { status: "RETRY", error: pe.message, finishedAt, durationMs });
        return { kind: "retrying", stage: def.key, reason: pe.message };
      }
    }
    return { kind: "idle", reason: "advance guard exhausted" };
  }

  /** Drive a run across several contiguous stages (stops at any boundary). */
  async run(runId: string, maxSteps = 10): Promise<{ steps: number; last: AdvanceOutcome }> {
    let last: AdvanceOutcome = { kind: "idle" };
    let steps = 0;
    for (; steps < maxSteps; steps++) {
      last = await this.advance(runId);
      if (last.kind !== "advanced") break;
    }
    return { steps, last };
  }

  /**
   * Scheduled entry point (cron / external pinger). Catch-up by design:
   * whatever happened while nobody was looking is repaired here — stale
   * RUNNING stages, due timing holds, provider holds that can now clear, and
   * QUEUED runs waiting to start. It NEVER resumes human/budget/qa holds.
   */
  async tick(): Promise<TickSummary> {
    const store = this.deps.store;
    const now = this.now();
    const summary: TickSummary = { recovered: [], resumed: [], cycled: [], outcomes: {} };
    const seen = new Set<string>();

    const staleBefore = new Date(now.getTime() - (this.deps.staleMinutes ?? 15) * 60_000);
    const stale = await store.listRuns({ statuses: ["RUNNING"], staleBefore, limit: 10 });
    for (const r of stale) {
      const stages = await store.listStages(r.id);
      let recovered = false;
      for (const s of stages) {
        if (s.status === "RUNNING" && (!s.startedAt || s.startedAt <= staleBefore)) {
          await store.updateStage(r.id, s.stageKey, { status: "RETRY", error: "استُعيدت بعد تعليق (stale RUNNING)" });
          recovered = true;
        }
      }
      if (recovered) summary.recovered.push(r.id);
      seen.add(r.id);
      const outcome = await this.run(r.id);
      bump(summary.outcomes, outcome.last.kind);
    }

    const due = await store.listRuns({ statuses: ["RUNNING", "HOLD"], scheduledBefore: now, limit: 20 });
    for (const r of due) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      const resumed = await this.resumeIfPossible(r.id);
      if (resumed) summary.resumed.push(r.id);
      const outcome = await this.run(r.id);
      bump(summary.outcomes, outcome.last.kind);
    }

    const held = await store.listRuns({ statuses: ["HOLD"], limit: 20 });
    for (const r of held) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      const resumed = await this.resumeIfPossible(r.id);
      if (!resumed) continue;
      summary.resumed.push(r.id);
      const outcome = await this.run(r.id);
      bump(summary.outcomes, outcome.last.kind);
    }

    const queued = await store.listRuns({ statuses: ["QUEUED"], limit: 5 });
    for (const r of queued) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      summary.cycled.push(r.id);
      const outcome = await this.run(r.id);
      bump(summary.outcomes, outcome.last.kind);
    }

    return summary;
  }

  /**
   * Human decision on a parked run:
   *   approve — pass the stage (S0 → DNA approved; low-score QA is force-passed
   *             and the publish guard honours the explicit override)
   *   reject  — fail the run, tag the reason (learning loop input)
   *   retry   — another attempt, optionally rewinding to an earlier stage
   *   resume  — clear a budget/provider/gate hold and continue
   */
  async decide(runId: string, decision: Decision, opts: DecideOptions): Promise<AdvanceOutcome> {
    const store = this.deps.store;
    const run = await store.getRun(runId);
    if (!run) return { kind: "idle", reason: `run ${runId} not found` };
    const row = (await store.listStages(runId)).find((s) => s.status === "WAITING");
    if (!row) return { kind: "idle", reason: "no stage is waiting" };
    const stageKey = row.stageKey as StageKey;
    const def = STAGE_BY_KEY[stageKey];
    const now = this.now();

    await store.addAudit({
      action: `pipeline:${decision}`,
      actorId: opts.actorId,
      actorRole: "owner",
      targetUserId: run.userId,
      metadata: { runId, stageKey, reason: opts.reason ?? null, toStage: opts.toStage ?? null },
    });

    if (decision === "approve") {
      const forced = (row.score ?? 0) < CONFIG.qa.passScore && (stageKey === "S8" || stageKey === "S0" || stageKey === "S9");
      if (stageKey === "S0") await store.approveDna(run.channelId, opts.actorId);
      await store.updateStage(runId, stageKey, {
        status: "PASSED",
        finishedAt: now,
        error: null,
        checkpoint: { _decided: { by: opts.actorId, at: now.toISOString() }, ...(forced ? { _forced: true } : {}) },
      });
      await store.updateRun(runId, { status: "RUNNING", currentStage: def ? def.index + 1 : run.currentStage, lastError: null });
      return { kind: "advanced", stage: stageKey, score: row.score ?? undefined };
    }

    if (decision === "reject") {
      const reason = opts.reason ?? "رُفض من المراجع البشري";
      let tags: string[] = [];
      try {
        const out = (await executeSkill(rejectionTagger, this.minimalRuntime(run, row), { reason })) as { tags?: string[] };
        tags = out.tags ?? [];
      } catch {
        // tagging is best-effort; the rejection itself still stands
      }
      await store.updateStage(runId, stageKey, {
        status: "FAILED",
        error: reason,
        finishedAt: now,
        checkpoint: { rejection: { reason, tags, at: now.toISOString() } },
      });
      await store.updateRun(runId, { status: "FAILED", lastError: reason });
      await this.notifyOwner(run, "run_rejected", `رُفضت الرحلة ${runId} (${stageKey})`, `${reason}${tags.length ? ` [${tags.join("، ")}]` : ""}`);
      return { kind: "failed", stage: stageKey, reason };
    }

    if (decision === "retry") {
      const to = opts.toStage ?? stageKey;
      const fromIndex = STAGE_KEYS.indexOf(to);
      if (fromIndex >= 0 && fromIndex < row.index) {
        await store.resetStagesFrom(runId, fromIndex, `قرار بشري: إعادة من ${to} — ${opts.note ?? opts.reason ?? ""}`.slice(0, 300));
      } else {
        await store.updateStage(runId, stageKey, { status: "PENDING" });
      }
      await store.updateRun(runId, { status: "RUNNING", lastError: null });
      return { kind: "retrying", stage: stageKey, reason: opts.reason ?? "إعادة بناءً على قرار بشري", to };
    }

    // resume
    await store.updateStage(runId, stageKey, { status: "PENDING" });
    await store.updateRun(runId, { status: "RUNNING", lastError: null });
    return { kind: "retrying", stage: stageKey, reason: opts.reason ?? "استئناف بعد إزالة العائق" };
  }

  /** resume ONLY machine-clearable holds (timing due, provider keys added) */
  private async resumeIfPossible(runId: string): Promise<boolean> {
    const store = this.deps.store;
    const row = (await store.listStages(runId)).find((s) => s.status === "WAITING");
    if (!row) return false;
    const hold = this.holdOf(row);
    const now = this.now();
    if (hold.kind === "timing") {
      const wake = hold.wakeAtIso ? new Date(hold.wakeAtIso) : null;
      if (!wake || wake.getTime() > now.getTime()) return false;
    } else if (hold.kind !== "provider") {
      return false;
    }
    await store.updateStage(runId, row.stageKey, { status: "PENDING" });
    await store.updateRun(runId, { status: "RUNNING", scheduledFor: null, lastError: null });
    return true;
  }

  // ── internals ──────────────────────────────────────────────────

  private holdOf(row: StageRecord): StageHold {
    const checkpoint = row.checkpoint as { _hold?: StageHold; _human?: boolean };
    if (checkpoint._hold) return checkpoint._hold;
    if (checkpoint._human) return { kind: "gate", reason: "بانتظار قرار بشري" };
    return { kind: "gate", reason: row.error ?? "متوقف بانتظار عائق" };
  }

  private async parkedStageKey(runId: string): Promise<StageKey | null> {
    const stages = await this.deps.store.listStages(runId);
    const row = stages.find((s) => s.status === "WAITING" || s.status === "FAILED");
    return (row?.stageKey as StageKey | undefined) ?? null;
  }

  private async holdStage(run: RunRecord, def: StageDefinition, row: StageRecord, hold: StageHold): Promise<void> {
    const store = this.deps.store;
    const wasParked = row.status === "WAITING" && this.holdOf(row).reason === hold.reason;
    await store.updateStage(run.id, def.key, { status: "WAITING", checkpoint: { _hold: hold }, error: hold.reason });
    if (run.status !== "HOLD") await store.updateRun(run.id, { status: "HOLD", lastError: hold.reason });
    else if (run.lastError !== hold.reason) await store.updateRun(run.id, { lastError: hold.reason });
    if (!wasParked && hold.kind !== "provider") {
      await this.notifyOwner(run, "run_hold", `الرحلة ${run.id} توقفت عند ${def.key}`, hold.reason);
    }
  }

  private async notifyOwner(run: RunRecord, kind: string, title: string, body: string): Promise<void> {
    try {
      await this.deps.notify({ kind, title, body, runId: run.id, userId: run.userId });
    } catch {
      // notifications must never break a run
    }
  }

  private minimalRuntime(run: RunRecord, row: StageRecord): SkillRuntime {
    const store = this.deps.store;
    return {
      run,
      stageKey: row.stageKey as StageKey,
      stageRowId: row.id,
      llm: this.deps.llm,
      media: this.deps.media,
      store,
      now: () => this.now(),
      log: () => {},
      spend: async (entry) =>
        this.cost.record({ ...entry, runId: run.id, stageKey: row.stageKey }),
      recordQa: async (qa) => store.addQa({ runId: run.id, stageKey: row.stageKey, stageRowId: row.id, ...qa }),
    };
  }

  private async buildContext(run: RunRecord, def: StageDefinition, row: StageRecord, stages: StageRecord[]): Promise<StageContext> {
    const store = this.deps.store;
    const dna = await store.getDna(run.channelId);
    const channel = await store.getChannelContext(run.channelId);
    const skills = skillsForStage(def.key, run.path);

    const recordQa = async (qa: Parameters<StageContext["recordQa"]>[0]) => {
      await store.addQa({ runId: run.id, stageKey: def.key, stageRowId: row.id, ...qa });
    };
    const spend = async (entry: Parameters<StageContext["spend"]>[0]) => {
      await this.cost.record({ ...entry, runId: run.id, stageKey: def.key });
    };

    return {
      run,
      dna,
      channel,
      stageRow: row,
      store,
      llm: this.deps.llm,
      media: this.deps.media,
      youtube: this.deps.youtube,
      notify: async (n) => {
        try {
          await this.deps.notify({ ...n, runId: n.runId ?? run.id, userId: n.userId ?? run.userId });
        } catch {
          // best-effort
        }
      },
      now: () => this.now(),
      fetchPage: this.deps.fetchPage,
      inputs: {
        of: (key) => stages.find((s) => s.stageKey === key)?.output ?? null,
        stage: (key) => stages.find((s) => s.stageKey === key) ?? null,
        all: () => stages,
      },
      skills,
      skill: this.minimalRuntime(run, row),
      log: () => {},
      recordQa,
      spend,
      usesAvatar: () => run.path === "AVATAR" || run.path === "MIXED",
    };
  }
}

export type { PipelineError };
