/**
 * The Owner Operator tool registry — the ONLY actions the admin AI can take.
 *
 * Every tool is a closed zod contract. Read tools execute immediately; write
 * tools are proposed to the owner and require a signed confirmation token
 * (see token.ts). No tool can run shell commands, write SQL, read secrets or
 * disable a security control.
 */
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import {
  createPromoCode,
  deletePromoCode,
  getActivePlans,
  getFinance,
  getOverview,
  getSecurityEvents,
  getUserById,
  grantFreeAccess,
  listAuditLogs,
  listContactInquiries,
  listPromoCodes,
  listUsers,
  sendWarning,
  setAutoTrialSetting,
  setUserStatus,
  togglePromoCode,
  updatePlan,
} from "@/lib/admin/data";
import { createPipelineEngine } from "@/src/pipeline/runtime";
import type { StageKey } from "@/src/pipeline/stage";
import { runReadOnlyQuery, SQL_DEFAULT_ROWS, SQL_MAX_ROWS } from "./sql";

export interface OperatorActor {
  id: string;
  email: string;
}

export interface ToolContext {
  actor: OperatorActor;
}

export interface OperatorToolDef<I extends z.ZodType> {
  name: string;
  description: string;
  kind: "read" | "write";
  /** the confirmation card gets a red treatment */
  destructive?: boolean;
  input: I;
  run: (input: z.infer<I>, ctx: ToolContext) => Promise<unknown>;
  /** one-line human summary for the confirmation card */
  summarize?: (input: z.infer<I>) => string;
}

export type AnyOperatorTool = OperatorToolDef<z.ZodType>;

function defineTool<I extends z.ZodType>(def: OperatorToolDef<I>): AnyOperatorTool {
  return def as unknown as AnyOperatorTool;
}

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}([T ].*)?$/, "Use an ISO date (YYYY-MM-DD)")
  .max(40);

const userId = z.string().min(10).max(60);
const runId = z.string().min(5).max(60);

// ── Read tools ─────────────────────────────────────────────────────────────

const platformOverview = defineTool({
  name: "platform_overview",
  description: "Platform KPIs, revenue, security warnings, queue backlog and live system health.",
  kind: "read",
  input: z.strictObject({}),
  run: () => getOverview(),
});

const searchUsers = defineTool({
  name: "search_users",
  description: "Search users by name or email (empty query returns the newest users).",
  kind: "read",
  input: z.strictObject({
    query: z.string().max(120).default(""),
    limit: z.number().int().min(1).max(50).default(20),
  }),
  run: async (input) => {
    const users = await listUsers(input.query);
    return users.slice(0, input.limit).map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      channels: u.channels.map((c) => ({ id: c.id, title: c.title, subscribers: c.subscriberCount })),
      subscription: u.subscription ? { plan: u.subscription.plan, status: u.subscription.status } : null,
      createdAt: u.createdAt,
    }));
  },
});

const getUser = defineTool({
  name: "get_user",
  description: "Full profile of one user: channels, subscription. Provide userId or an exact email.",
  kind: "read",
  input: z
    .strictObject({ userId: userId.optional(), email: z.string().email().max(320).optional() })
    .refine((v) => Boolean(v.userId || v.email), "userId or email is required"),
  run: async (input) => {
    let user = input.userId ? await getUserById(input.userId) : null;
    if (!user && input.email) {
      const matches = await listUsers(input.email);
      user = matches.find((u) => u.email.toLowerCase() === input.email!.toLowerCase()) ?? null;
    }
    if (!user) return { found: false };
    return {
      found: true,
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      channels: user.channels,
      subscription: user.subscription,
      createdAt: user.createdAt,
    };
  },
});

const listAudit = defineTool({
  name: "list_audit_logs",
  description: "Search the immutable audit log by free text or exact action key.",
  kind: "read",
  input: z.strictObject({
    search: z.string().max(120).optional(),
    action: z.string().max(80).optional(),
    limit: z.number().int().min(1).max(50).default(20),
  }),
  run: async (input) => listAuditLogs({ search: input.search, action: input.action, limit: input.limit }),
});

const financeSummary = defineTool({
  name: "finance_summary",
  description: "MRR/ARR, churn, plan breakdown and the latest invoices.",
  kind: "read",
  input: z.strictObject({}),
  run: () => getFinance(),
});

const listPlans = defineTool({
  name: "list_plans",
  description: "Current plan names and monthly/yearly prices.",
  kind: "read",
  input: z.strictObject({}),
  run: () => getActivePlans(),
});

const listPromos = defineTool({
  name: "list_promo_codes",
  description: "All promo/discount codes with usage and expiry.",
  kind: "read",
  input: z.strictObject({}),
  run: () => listPromoCodes(),
});

const securityEvents = defineTool({
  name: "security_events",
  description: "Recent security events (lockouts, failed magic links, rate limits).",
  kind: "read",
  input: z.strictObject({ limit: z.number().int().min(1).max(50).default(20) }),
  run: async (input) => (await getSecurityEvents()).slice(0, input.limit),
});

const contactInquiries = defineTool({
  name: "contact_inquiries",
  description: "Messages/reports visitors sent from the contact form.",
  kind: "read",
  input: z.strictObject({ limit: z.number().int().min(1).max(20).default(10) }),
  run: async (input) => (await listContactInquiries()).slice(0, input.limit),
});

const pipelineRuns = defineTool({
  name: "pipeline_runs",
  description: "List pipeline runs (newest first) with status, cost and last error.",
  kind: "read",
  input: z.strictObject({
    status: z.enum(["QUEUED", "RUNNING", "WAITING_HUMAN", "HOLD", "FAILED", "PUBLISHED", "DONE"]).optional(),
    limit: z.number().int().min(1).max(20).default(10),
  }),
  run: async (input) => {
    const runs = await prisma.run.findMany({
      where: input.status ? { status: input.status } : undefined,
      orderBy: { createdAt: "desc" },
      take: input.limit,
      select: {
        id: true,
        status: true,
        path: true,
        mode: true,
        currentStage: true,
        costCapCents: true,
        costSpentCents: true,
        scheduledFor: true,
        lastError: true,
        createdAt: true,
        channel: { select: { title: true } },
      },
    });
    return runs.map((r) => ({
      ...r,
      channel: r.channel.title,
      createdAt: r.createdAt.toISOString(),
      scheduledFor: r.scheduledFor?.toISOString() ?? null,
    }));
  },
});

const pipelineRun = defineTool({
  name: "pipeline_run",
  description: "One pipeline run in detail: stages, QA evidence count, ledger total.",
  kind: "read",
  input: z.strictObject({ runId }),
  run: async (input) => {
    const run = await prisma.run.findUnique({
      where: { id: input.runId },
      include: {
        stages: {
          orderBy: { index: "asc" },
          select: { stageKey: true, status: true, score: true, attempts: true, error: true, updatedAt: true },
        },
        ledger: { select: { costCents: true } },
        qaReports: { orderBy: { createdAt: "desc" }, take: 8, select: { checkKey: true, kind: true, passed: true, score: true, createdAt: true } },
      },
    });
    if (!run) return { found: false };
    return {
      found: true,
      id: run.id,
      status: run.status,
      path: run.path,
      currentStage: run.currentStage,
      costCapCents: run.costCapCents,
      costSpentCents: run.costSpentCents,
      ledgerTotal: run.ledger.reduce((sum, l) => sum + l.costCents, 0),
      lastError: run.lastError,
      stages: run.stages.map((s) => ({ ...s, updatedAt: s.updatedAt.toISOString() })),
      qa: run.qaReports.map((q) => ({ ...q, createdAt: q.createdAt.toISOString() })),
    };
  },
});

const sqlRead = defineTool({
  name: "sql_read",
  description:
    "Read-only SQL investigation. One SELECT or WITH statement, no comments, no writes/DDL, max 200 rows. Credential columns are redacted.",
  kind: "read",
  input: z.strictObject({
    sql: z.string().min(8).max(2000),
    maxRows: z.number().int().min(1).max(SQL_MAX_ROWS).default(SQL_DEFAULT_ROWS),
  }),
  run: (input) => runReadOnlyQuery(input.sql, input.maxRows),
});

// ── Write tools (always confirmed by the owner) ────────────────────────────

const suspendUser = defineTool({
  name: "suspend_user",
  description: "Suspend a user account (blocks dashboard access). Optionally sends them a warning message.",
  kind: "write",
  destructive: true,
  input: z.strictObject({
    userId,
    reason: z.string().min(5).max(300),
    notifyMessage: z.string().min(5).max(1000).optional(),
  }),
  run: async (input) => {
    const user = await setUserStatus(input.userId, "SUSPENDED");
    if (!user) throw new Error("USER_NOT_FOUND");
    let warningSent = false;
    if (input.notifyMessage) {
      const notice = await sendWarning(input.userId, input.notifyMessage);
      warningSent = Boolean(notice);
    }
    return { ok: true, userId: input.userId, status: "SUSPENDED", warningSent };
  },
  summarize: (input) => `Suspend user ${input.userId} — ${input.reason}`,
});

const reactivateUser = defineTool({
  name: "reactivate_user",
  description: "Reactivate a suspended user account.",
  kind: "write",
  input: z.strictObject({ userId, reason: z.string().min(5).max(300) }),
  run: async (input) => {
    const user = await setUserStatus(input.userId, "ACTIVE");
    if (!user) throw new Error("USER_NOT_FOUND");
    return { ok: true, userId: input.userId, status: "ACTIVE" };
  },
  summarize: (input) => `Reactivate user ${input.userId} — ${input.reason}`,
});

const grantPlan = defineTool({
  name: "grant_plan",
  description: "Grant a free plan to one user for N days.",
  kind: "write",
  input: z.strictObject({
    userId,
    planId: z.enum(["starter", "growth", "agency"]),
    durationDays: z.number().int().min(1).max(3650),
  }),
  run: async (input) => grantFreeAccess({ userId: input.userId, planId: input.planId, durationDays: input.durationDays }),
  summarize: (input) => `Grant ${input.planId} for ${input.durationDays} days to ${input.userId}`,
});

const sendWarningTool = defineTool({
  name: "send_warning",
  description: "Send an in-app warning notice to one user.",
  kind: "write",
  input: z.strictObject({ userId, message: z.string().min(5).max(1000) }),
  run: async (input) => {
    const notice = await sendWarning(input.userId, input.message);
    if (!notice) throw new Error("USER_NOT_FOUND");
    return { ok: true, userId: input.userId, notice };
  },
  summarize: (input) => `Send a warning to ${input.userId}`,
});

const createPromo = defineTool({
  name: "create_promo_code",
  description: "Create a discount code (percent or fixed amount).",
  kind: "write",
  input: z.strictObject({
    code: z.string().min(3).max(40),
    discountType: z.enum(["percent", "fixed"]),
    discountValue: z.number().min(1).max(100_000),
    expiryDate: isoDate.optional(),
    maxUses: z.number().int().min(1).max(1_000_000).optional(),
  }),
  run: async (input) =>
    createPromoCode({
      code: input.code,
      discountType: input.discountType,
      discountValue: input.discountValue,
      expiryDate: input.expiryDate ?? null,
      maxUses: input.maxUses ?? null,
    }),
  summarize: (input) => `Create promo ${input.code} (${input.discountType} ${input.discountValue})`,
});

const togglePromo = defineTool({
  name: "toggle_promo_code",
  description: "Enable or disable an existing promo code.",
  kind: "write",
  input: z.strictObject({ id: z.string().min(3).max(60), active: z.boolean() }),
  run: async (input) => {
    const ok = await togglePromoCode(input.id, input.active);
    if (!ok) throw new Error("PROMO_NOT_FOUND");
    return { ok: true, id: input.id, active: input.active };
  },
  summarize: (input) => `${input.active ? "Enable" : "Disable"} promo ${input.id}`,
});

const deletePromo = defineTool({
  name: "delete_promo_code",
  description: "Permanently delete a promo code.",
  kind: "write",
  destructive: true,
  input: z.strictObject({ id: z.string().min(3).max(60) }),
  run: async (input) => {
    const ok = await deletePromoCode(input.id);
    if (!ok) throw new Error("PROMO_NOT_FOUND");
    return { ok: true, id: input.id };
  },
  summarize: (input) => `DELETE promo code ${input.id} (irreversible)`,
});

const updatePlanTool = defineTool({
  name: "update_plan",
  description: "Change a plan's display name and/or monthly/yearly price.",
  kind: "write",
  input: z
    .strictObject({
      id: z.enum(["starter", "growth", "agency"]),
      name: z.string().min(2).max(40).optional(),
      monthlyPrice: z.number().min(0).max(100_000).optional(),
      yearlyPrice: z.number().min(0).max(100_000).optional(),
    })
    .refine((v) => v.name !== undefined || v.monthlyPrice !== undefined || v.yearlyPrice !== undefined, "At least one field is required"),
  run: async (input) => {
    const plan = await updatePlan(input.id, { name: input.name, monthlyPrice: input.monthlyPrice, yearlyPrice: input.yearlyPrice });
    if (!plan) throw new Error("PLAN_NOT_FOUND");
    return plan;
  },
  summarize: (input) => `Update plan ${input.id} pricing/name`,
});

const setAutoTrial = defineTool({
  name: "set_auto_trial",
  description: "Enable or disable the automatic 14-day trial for new customers.",
  kind: "write",
  input: z.strictObject({ enabled: z.boolean() }),
  run: async (input) => ({ ok: true, autoTrialEnabled: await setAutoTrialSetting(input.enabled) }),
  summarize: (input) => `${input.enabled ? "Enable" : "Disable"} automatic 14-day trial`,
});

const setSiteFree = defineTool({
  name: "set_site_free_access",
  description: "Grant free access to everyone or one user, for a chosen plan and duration.",
  kind: "write",
  input: z.strictObject({
    userId: userId.nullable().default(null),
    planId: z.enum(["starter", "growth", "agency"]).nullable().default(null),
    durationDays: z.number().int().min(1).max(3650),
  }),
  run: async (input) => grantFreeAccess({ userId: input.userId, planId: input.planId, durationDays: input.durationDays }),
  summarize: (input) =>
    `Free access: ${input.userId ? `user ${input.userId}` : "everyone"} · ${input.planId ?? "all plans"} · ${input.durationDays} days`,
});

const advanceRun = defineTool({
  name: "advance_pipeline_run",
  description: "Advance a pipeline run by up to 25 guarded engine steps.",
  kind: "write",
  input: z.strictObject({ runId, maxSteps: z.number().int().min(1).max(25).default(10) }),
  run: async (input) => {
    const result = await createPipelineEngine().run(input.runId, input.maxSteps);
    return { steps: result.steps, last: result.last };
  },
  summarize: (input) => `Advance pipeline run ${input.runId}`,
});

const decideRun = defineTool({
  name: "decide_pipeline_run",
  description: "Human decision on a parked run: approve, reject, resume or retry (optionally rewinding to toStage).",
  kind: "write",
  destructive: true,
  input: z.strictObject({
    runId,
    decision: z.enum(["approve", "reject", "resume", "retry"]),
    reason: z.string().min(2).max(1000).optional(),
    toStage: z.string().regex(/^S\d{1,2}$/).optional(),
  }),
  run: async (input, ctx) => {
    const outcome = await createPipelineEngine().decide(input.runId, input.decision, {
      actorId: ctx.actor.id,
      reason: input.reason,
      toStage: input.toStage as StageKey | undefined,
    });
    return outcome;
  },
  summarize: (input) => `${input.decision.toUpperCase()} pipeline run ${input.runId}${input.reason ? ` — ${input.reason}` : ""}`,
});

const notifyUserTool = defineTool({
  name: "notify_user",
  description: "Create an in-app notification for one user.",
  kind: "write",
  input: z.strictObject({
    userId,
    title: z.string().min(3).max(120),
    body: z.string().min(5).max(1000),
  }),
  run: async (input) => {
    const row = await prisma.notification.create({
      data: { userId: input.userId, channel: "in_app", kind: "admin_message", title: input.title, body: input.body },
      select: { id: true, createdAt: true },
    });
    return { ok: true, id: row.id, createdAt: row.createdAt.toISOString() };
  },
  summarize: (input) => `Notify ${input.userId}: ${input.title}`,
});

// ── Registry ───────────────────────────────────────────────────────────────

const TOOLS: AnyOperatorTool[] = [
  platformOverview,
  searchUsers,
  getUser,
  listAudit,
  financeSummary,
  listPlans,
  listPromos,
  securityEvents,
  contactInquiries,
  pipelineRuns,
  pipelineRun,
  sqlRead,
  suspendUser,
  reactivateUser,
  grantPlan,
  sendWarningTool,
  createPromo,
  togglePromo,
  deletePromo,
  updatePlanTool,
  setAutoTrial,
  setSiteFree,
  advanceRun,
  decideRun,
  notifyUserTool,
];

export const OPERATOR_TOOLS: ReadonlyMap<string, AnyOperatorTool> = new Map(TOOLS.map((t) => [t.name, t]));

export function getOperatorTool(name: string): AnyOperatorTool | undefined {
  return OPERATOR_TOOLS.get(name);
}

export function listOperatorTools(): AnyOperatorTool[] {
  return TOOLS;
}

/** Compact catalog injected into the system prompt (name, kind, description, input schema). */
export function operatorToolCatalog(): string {
  const catalog = TOOLS.map((t) => {
    let schema: unknown;
    try {
      schema = z.toJSONSchema(t.input);
    } catch {
      schema = { type: "object" };
    }
    return { name: t.name, kind: t.kind, destructive: Boolean(t.destructive), description: t.description, input: schema };
  });
  return JSON.stringify(catalog);
}
