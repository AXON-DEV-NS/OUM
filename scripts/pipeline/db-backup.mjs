#!/usr/bin/env node
/**
 * Full-database JSON backup for the OUM pipeline.
 *
 * Why: pg_dump is not available in this environment, but the pipeline doses
 * schema changes on top of live data. This script snapshots every table to a
 * single timestamped JSON file so a bad migration can always be reversed by
 * the operator.
 *
 * Usage:
 *   node scripts/pipeline/db-backup.mjs            # write a backup
 *   node scripts/pipeline/db-backup.mjs --quiet    # only print the summary line
 *
 * Output: backups/backup-<ISO-timestamp>.json (keeps the last 10 files).
 */
import { readFileSync, mkdirSync, writeFileSync, readdirSync, unlinkSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const quiet = process.argv.includes("--quiet");

// Load DATABASE_URL from .env.local when the shell has not exported it.
if (!process.env.DATABASE_URL) {
  try {
    const env = readFileSync(join(root, ".env.local"), "utf8");
    for (const line of env.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // no .env.local — rely on the ambient environment
  }
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

// Every model in prisma/schema.prisma, in dependency-free read order.
const TABLES = [
  "user", "session", "channel", "niche", "bestPractice", "thingToAvoid", "mistakeLog",
  "contentItem", "contentStatusEvent", "subscription", "invoice", "supportTicket",
  "ticketMessage", "auditLog", "securityChatMessage", "securityEvent", "apiServiceKey",
  "youTubeCache", "searchProviderState", "searchCache", "systemSetting", "promoCode",
  "freeGrant", "userNotice", "channelDna", "run", "runStage", "asset", "qaReport",
  "costLedger", "nicheKb", "notification",
];

const backupDir = join(root, "backups");
mkdirSync(backupDir, { recursive: true });

const snapshot = { takenAt: new Date().toISOString(), tables: {} };
let totalRows = 0;
const missing = [];

for (const table of TABLES) {
  const delegate = prisma[table];
  if (!delegate || typeof delegate.findMany !== "function") {
    missing.push(table);
    continue;
  }
  const rows = await delegate.findMany();
  snapshot.tables[table] = rows;
  totalRows += rows.length;
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const file = join(backupDir, `backup-${stamp}.json`);
writeFileSync(file, JSON.stringify(snapshot, null, 0));

// Keep only the 10 most recent backups.
const files = readdirSync(backupDir)
  .filter((f) => f.startsWith("backup-") && f.endsWith(".json"))
  .map((f) => ({ f, m: statSync(join(backupDir, f)).mtimeMs }))
  .sort((a, b) => b.m - a.m);
for (const { f } of files.slice(10)) unlinkSync(join(backupDir, f));

const sizeKb = Math.round(statSync(file).size / 1024);
if (!quiet) {
  for (const [table, rows] of Object.entries(snapshot.tables)) {
    console.log(`${table.padEnd(22)} ${rows.length}`);
  }
  if (missing.length) console.log(`skipped (no delegate): ${missing.join(", ")}`);
}
console.log(`OK backup: ${file} (${totalRows} rows, ${sizeKb} KB, keeps last 10)`);

await prisma.$disconnect();
process.exit(0);
