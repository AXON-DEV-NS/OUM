/**
 * Local audit seed — populates the local PostgreSQL database with a realistic
 * demo dataset so every dashboard/admin surface renders with real data during
 * the visual audit. Destructive only to its own records (fixed demo ids).
 *
 * Usage: node scripts/audit-seed.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_USER_ID = "demo-creator-001";
const DEMO_EMAIL = "creator@oum.local";

async function main() {
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;

  // ── Demo creator ─────────────────────────────────────────────────────────
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { name: "Demo Creator" },
    create: {
      id: DEMO_USER_ID,
      email: DEMO_EMAIL,
      name: "Demo Creator",
      role: "CLIENT",
      status: "ACTIVE",
      onboardingStep: 8,
      onboardingCompletedAt: new Date(now.getTime() - 9 * day),
      tourSeenAt: new Date(now.getTime() - 9 * day),
      welcomeSeenAt: new Date(now.getTime() - 9 * day),
      customInstructions:
        "Keep the tone energetic but credible. Always cite sources in the description. Avoid clickbait titles.",
    },
  });

  // ── Subscription ─────────────────────────────────────────────────────────
  await prisma.subscription.upsert({
    where: { userId: user.id },
    update: { status: "ACTIVE", plan: "GROWTH" },
    create: {
      userId: user.id,
      plan: "GROWTH",
      status: "ACTIVE",
      currentPeriodStart: new Date(now.getTime() - 12 * day),
      currentPeriodEnd: new Date(now.getTime() + 18 * day),
    },
  });

  // ── Niche knowledge base ─────────────────────────────────────────────────
  const niche = await prisma.niche.upsert({
    where: { name: "technology" },
    update: {},
    create: {
      name: "technology",
      description:
        "Consumer technology, AI tools and practical software reviews for a mainstream English-speaking audience.",
      analysis: {
        audience: "25–44 technology professionals and early adopters",
        competitors: ["MKBHD", "Linus Tech Tips", "The Verge"],
        opportunities: [
          "Hands-on AI workflow comparisons",
          "Under-10-minute explainers",
          "Honest long-term reviews",
        ],
      },
      lastResearchedAt: new Date(now.getTime() - 2 * day),
      bestPractices: {
        create: [
          {
            title: "Open with the payoff",
            description:
              "Show the final result or the most surprising fact in the first 8 seconds — retention curves reward immediate value.",
            source: "initial research",
          },
          {
            title: "One idea per video",
            description:
              "Videos that teach exactly one thing outperform listicles across the niche's top performers.",
            source: "daily research",
          },
        ].map((p) => ({ ...p, discoveredAt: new Date(now.getTime() - 5 * day) })),
      },
      thingsToAvoid: {
        create: [
          {
            title: "Unverified benchmark claims",
            description:
              "Never quote performance numbers without a visible source or your own test footage — trust erosion is permanent.",
            source: "initial research",
          },
        ].map((p) => ({ ...p, discoveredAt: new Date(now.getTime() - 5 * day) })),
      },
      mistakeLogs: {
        create: [
          {
            title: "Mispronounced product name",
            description:
              "The AI voice said “Kuaishou” incorrectly in the intro of draft #12, which reviewers flagged twice.",
            correction:
              "Add a pronunciation guide field for brand names at script time and require a human check.",
            channelId: null,
            occurredAt: new Date(now.getTime() - 3 * day),
          },
        ],
      },
    },
  });

  // ── Channel ──────────────────────────────────────────────────────────────
  const channel = await prisma.channel.upsert({
    where: { userId_youtubeId: { userId: user.id, youtubeId: "UC_demo_techfrontiers" } },
    update: {},
    create: {
      userId: user.id,
      youtubeId: "UC_demo_techfrontiers",
      title: "Tech Frontiers",
      thumbnailUrl: null,
      subscriberCount: 48200,
      videoCount: 156,
      niche: "technology",
      nicheId: niche.id,
      markets: ["en", "de"],
      tone: "Confident, friendly, lightly humorous",
      requiresAvatar: true,
      referenceChannelUrl: "https://www.youtube.com/@mkbhd",
      referenceVideoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      connectedAt: new Date(now.getTime() - 15 * day),
    },
  });

  // ── Content pipeline (one per status for full coverage) ──────────────────
  const items = [
    {
      title: "The 5 AI tools that actually replaced my workflow in 2026",
      status: "PUBLISHED",
      publishedAt: new Date(now.getTime() - 1 * day),
      scheduledAt: new Date(now.getTime() - 1 * day),
    },
    {
      title: "I tested the new DeepSeek terminal agent for 30 days",
      status: "SCHEDULED",
      scheduledAt: new Date(now.getTime() + 2 * day),
    },
    {
      title: "Why local LLMs finally make sense on consumer laptops",
      status: "READY_FOR_REVIEW",
    },
    {
      title: "Building a home studio for under $300",
      status: "GENERATING",
    },
    {
      title: "The truth about AI video upscaling",
      status: "SCRIPT",
    },
    {
      title: "7 automations every creator should run weekly",
      status: "IDEA",
    },
  ];

  for (const [i, item] of items.entries()) {
    const existing = await prisma.contentItem.findFirst({
      where: { channelId: channel.id, title: item.title },
    });
    if (existing) continue;
    await prisma.contentItem.create({
      data: {
        channelId: channel.id,
        userId: user.id,
        title: item.title,
        status: item.status,
        scriptText:
          item.status === "IDEA"
            ? null
            : `HOOK — ${item.title}\n\nBODY — In this video we break down the practical reality behind the headline...`,
        mediaUrls: [],
        publishedAt: item.publishedAt ?? null,
        scheduledAt: item.scheduledAt ?? null,
        createdAt: new Date(now.getTime() - (10 - i) * day),
        reviewComment:
          item.status === "READY_FOR_REVIEW"
            ? "Awaiting the 1-click review from the creator."
            : null,
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: item.status,
            actor: "ai_agent",
            comment: "Seeded for local audit coverage.",
          },
        },
      },
    });
  }

  // ── Support ticket with conversation ─────────────────────────────────────
  let ticket = await prisma.supportTicket.findFirst({
    where: { userId: user.id, subject: "Scheduling timezone question" },
  });
  if (!ticket) {
    ticket = await prisma.supportTicket.create({
      data: {
        userId: user.id,
        subject: "Scheduling timezone question",
        description:
          "My channel publishes to a European audience — which timezone does the scheduler use when it picks the publishing slot?",
        priority: "NORMAL",
        status: "WAITING_ON_CLIENT",
        createdAt: new Date(now.getTime() - 4 * day),
        messages: {
          create: [
            {
              userId: user.id,
              content:
                "My channel publishes to a European audience — which timezone does the scheduler use?",
              createdAt: new Date(now.getTime() - 4 * day),
            },
            {
              userId: null,
              isStaff: true,
              content:
                "Great question — the planner converts every slot into the channel's primary audience timezone (settings → markets). Want us to enable EU primetime defaults for you?",
              createdAt: new Date(now.getTime() - 3 * day),
            },
          ],
        },
      },
    });
  }

  // ── Admin panel sample data ──────────────────────────────────────────────
  const secondUser = await prisma.user.upsert({
    where: { email: "studio@oum.local" },
    update: {},
    create: {
      email: "studio@oum.local",
      name: "Studio North",
      role: "CLIENT",
      status: "ACTIVE",
      createdAt: new Date(now.getTime() - 6 * day),
    },
  });

  await prisma.promoCode.upsert({
    where: { code: "LAUNCH40" },
    update: {},
    create: {
      code: "LAUNCH40",
      discountType: "percent",
      discountValue: 40,
      active: true,
      maxUses: 100,
      usedCount: 12,
      expiryDate: new Date(now.getTime() + 30 * day),
    },
  });

  await prisma.freeGrant.create({
    data: {
      userId: secondUser.id,
      planId: "GROWTH",
      durationDays: 14,
      expiresAt: new Date(now.getTime() + 9 * day),
    },
  }).catch(() => {});

  await prisma.userNotice.create({
    data: {
      userId: secondUser.id,
      email: "studio@oum.local",
      message: "Friendly reminder: connect your channel to unlock the content pipeline.",
      createdAt: new Date(now.getTime() - 2 * day),
    },
  }).catch(() => {});

  for (const [i, log] of [
    { action: "auth.login", actorId: user.id, actorRole: "client" },
    { action: "content.approved", actorId: user.id, actorRole: "client" },
    { action: "admin.login", actorId: "owner@vovo-agent.ai", actorRole: "admin" },
    { action: "billing.subscription.activated", actorId: user.id, actorRole: "client" },
    { action: "auth.rate_limited", actorId: "203.0.113.7", actorRole: "system" },
  ].entries()) {
    await prisma.auditLog.create({
      data: {
        ...log,
        ipAddress: "127.0.0.1",
        metadata: { source: "local-audit-seed" },
        timestamp: new Date(now.getTime() - i * 6 * 60 * 60 * 1000),
      },
    });
  }

  for (const [i, ev] of [
    { type: "NEW_DEVICE_LOGIN", severity: "WARNING", email: DEMO_EMAIL },
    { type: "RATE_LIMIT_EXCEEDED", severity: "WARNING", email: null },
    { type: "FAILED_MAGIC_LINK", severity: "WARNING", email: "unknown@example.com" },
  ].entries()) {
    await prisma.securityEvent.create({
      data: {
        ...ev,
        ipAddress: "203.0.113.7",
        userAgent: "Mozilla/5.0 (Local Audit)",
        details: { source: "local-audit-seed" },
        createdAt: new Date(now.getTime() - i * 3 * 60 * 60 * 1000),
      },
    });
  }

  console.log("Seed complete:");
  console.log(`  user:    ${DEMO_EMAIL} (id=${user.id})`);
  console.log(`  channel: ${channel.title}`);
  console.log(`  ticket:  ${ticket.id}`);
  console.log(`  content: ${await prisma.contentItem.count({ where: { userId: user.id } })} items`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
