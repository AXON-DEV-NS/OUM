-- Audit follow-up: foreign-key and query-shape indexes.
-- Postgres does not index foreign-key columns automatically, and the hot
-- queries (content lists, support threads, invoices, audit logs, security
-- events, session revocations) were sequential scans on an empty index set.

-- Content pipeline
CREATE INDEX "content_items_channelId_idx" ON "content_items"("channelId");
CREATE INDEX "content_items_userId_idx" ON "content_items"("userId");
CREATE INDEX "content_items_userId_status_idx" ON "content_items"("userId", "status");
CREATE INDEX "content_items_channelId_status_idx" ON "content_items"("channelId", "status");
CREATE INDEX "content_items_scheduledAt_idx" ON "content_items"("scheduledAt");
CREATE INDEX "content_status_events_contentItemId_idx" ON "content_status_events"("contentItemId");

-- Support
CREATE INDEX "support_tickets_userId_updatedAt_idx" ON "support_tickets"("userId", "updatedAt" DESC);
CREATE INDEX "support_tickets_status_updatedAt_idx" ON "support_tickets"("status", "updatedAt" DESC);
CREATE INDEX "ticket_messages_ticketId_idx" ON "ticket_messages"("ticketId");

-- Sessions & billing
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");
CREATE INDEX "invoices_subscriptionId_idx" ON "invoices"("subscriptionId");
CREATE INDEX "invoices_userId_createdAt_idx" ON "invoices"("userId", "createdAt" DESC);

-- Security & admin
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");
CREATE INDEX "audit_logs_targetUserId_idx" ON "audit_logs"("targetUserId");
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp" DESC);
CREATE INDEX "security_events_email_createdAt_idx" ON "security_events"("email", "createdAt");

-- Channels & niche knowledge
CREATE INDEX "channels_nicheId_idx" ON "channels"("nicheId");
CREATE INDEX "mistake_logs_channelId_idx" ON "mistake_logs"("channelId");
CREATE INDEX "user_notices_email_idx" ON "user_notices"("email");
