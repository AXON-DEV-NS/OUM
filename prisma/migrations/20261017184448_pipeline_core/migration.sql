-- CreateEnum
CREATE TYPE "RunPath" AS ENUM ('AVATAR', 'FACELESS', 'MIXED');

-- CreateEnum
CREATE TYPE "RunMode" AS ENUM ('COPILOT', 'AUTOPILOT');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('QUEUED', 'RUNNING', 'WAITING_HUMAN', 'HOLD', 'FAILED', 'PUBLISHED', 'DONE');

-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('PENDING', 'RUNNING', 'PASSED', 'FAILED', 'RETRY', 'SKIPPED', 'WAITING');

-- CreateTable
CREATE TABLE "channel_dna" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "rules" JSONB NOT NULL,
    "conflicts" JSONB,
    "competitors" JSONB,
    "audience" JSONB,
    "avatar" JSONB,
    "mode" JSONB NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_dna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "nicheKey" TEXT,
    "path" "RunPath" NOT NULL,
    "mode" "RunMode" NOT NULL DEFAULT 'COPILOT',
    "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
    "currentStage" INTEGER NOT NULL DEFAULT 0,
    "costCapCents" INTEGER NOT NULL,
    "costSpentCents" INTEGER NOT NULL DEFAULT 0,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "scheduledFor" TIMESTAMP(3),
    "idempotencyKey" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "run_stages" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stageKey" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "status" "StageStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "checkpoint" JSONB,
    "input" JSONB,
    "output" JSONB,
    "score" INTEGER,
    "skillVersions" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "stage" TEXT,
    "filePath" TEXT,
    "mimeType" TEXT,
    "bytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "durationSec" DOUBLE PRECISION,
    "source" TEXT NOT NULL,
    "provider" TEXT,
    "license" TEXT,
    "licenseUrl" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qa_reports" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stageKey" TEXT NOT NULL,
    "stageRowId" TEXT,
    "checkKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "score" INTEGER,
    "passed" BOOLEAN NOT NULL,
    "reasons" JSONB,
    "action" TEXT,
    "judgeModel" TEXT,
    "writerModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qa_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_ledger" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stageKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "units" JSONB,
    "costCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "niche_kb" (
    "id" TEXT NOT NULL,
    "nicheKey" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'niche',
    "channelId" TEXT,
    "lesson" TEXT NOT NULL,
    "lessonHash" TEXT NOT NULL,
    "evidence" JSONB,
    "confidence" INTEGER NOT NULL DEFAULT 1,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "niche_kb_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "runId" TEXT,
    "channel" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "channel_dna_channelId_key" ON "channel_dna"("channelId");

-- CreateIndex
CREATE UNIQUE INDEX "runs_idempotencyKey_key" ON "runs"("idempotencyKey");

-- CreateIndex
CREATE INDEX "runs_userId_status_idx" ON "runs"("userId", "status");

-- CreateIndex
CREATE INDEX "runs_channelId_status_idx" ON "runs"("channelId", "status");

-- CreateIndex
CREATE INDEX "runs_status_scheduledFor_idx" ON "runs"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "run_stages_runId_index_idx" ON "run_stages"("runId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "run_stages_runId_stageKey_key" ON "run_stages"("runId", "stageKey");

-- CreateIndex
CREATE INDEX "assets_runId_kind_idx" ON "assets"("runId", "kind");

-- CreateIndex
CREATE INDEX "qa_reports_runId_stageKey_idx" ON "qa_reports"("runId", "stageKey");

-- CreateIndex
CREATE INDEX "cost_ledger_runId_createdAt_idx" ON "cost_ledger"("runId", "createdAt");

-- CreateIndex
CREATE INDEX "niche_kb_nicheKey_status_idx" ON "niche_kb"("nicheKey", "status");

-- CreateIndex
CREATE UNIQUE INDEX "niche_kb_nicheKey_lessonHash_key" ON "niche_kb"("nicheKey", "lessonHash");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "notifications_runId_idx" ON "notifications"("runId");

-- AddForeignKey
ALTER TABLE "channel_dna" ADD CONSTRAINT "channel_dna_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runs" ADD CONSTRAINT "runs_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "run_stages" ADD CONSTRAINT "run_stages_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qa_reports" ADD CONSTRAINT "qa_reports_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qa_reports" ADD CONSTRAINT "qa_reports_stageRowId_fkey" FOREIGN KEY ("stageRowId") REFERENCES "run_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_ledger" ADD CONSTRAINT "cost_ledger_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_runId_fkey" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
