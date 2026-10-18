/**
 * Read-only SQL for the Owner Operator.
 *
 * Defense in depth:
 *   1. static validation (single SELECT/WITH statement, no comments, no
 *      dangerous keywords/functions, no sensitive tables),
 *   2. a PostgreSQL READ ONLY transaction + 3s statement timeout,
 *   3. a hard row cap and result-size cap,
 *   4. redaction of credential-like columns before the rows ever leave the
 *      server (they must never reach the model provider or the browser).
 */
import { prisma } from "@/lib/db/prisma";

const FORBIDDEN_KEYWORDS =
  /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call|do|merge|vacuum|analyze|reindex|cluster|listen|notify|unlisten|set|reset|begin|commit|rollback|savepoint|release|lock|prepare|execute|deallocate|discard|attach|detach|import|refresh|into)\b/i;

const FORBIDDEN_FUNCTIONS =
  /\b(pg_sleep|pg_read_file|pg_read_binary_file|pg_ls_dir|pg_stat_file|lo_import|lo_export|dblink|current_setting|set_config|pg_terminate_backend|pg_cancel_backend|pg_reload_conf|pg_rotate_logfile|pg_switch_wal|pg_create_restore_point|pg_promote|pg_backend_pid)\s*\(/i;

/** Tables that must never be exposed through the investigation console. */
const BLOCKED_TABLES = [
  "sessions",
  "api_service_keys",
  "security_chat_messages",
  "pg_shadow",
  "pg_authid",
  "pg_stat_activity",
  "pg_stat_statements",
];

/** Columns whose values are replaced with [redacted] before leaving the server. */
const SENSITIVE_COLUMN =
  /(password|passwd|hash|salt|secret|token|api[_-]?key|credential|totp|otp|verification|private[_-]?key)/i;

export const SQL_MAX_ROWS = 200;
export const SQL_DEFAULT_ROWS = 50;
const SQL_MAX_CHARS = 2000;
const RESULT_MAX_CHARS = 120_000;

export interface SqlValidation {
  ok: boolean;
  sql?: string;
  reason?: string;
}

export function validateReadOnlySql(raw: string): SqlValidation {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, reason: "SQL is empty" };
  let sql = raw.trim();
  if (sql.length > SQL_MAX_CHARS) return { ok: false, reason: `SQL is longer than ${SQL_MAX_CHARS} characters` };

  if (sql.endsWith(";")) sql = sql.slice(0, -1).trim();
  if (sql.includes(";")) return { ok: false, reason: "Multiple statements are not allowed" };
  if (sql.includes("--") || sql.includes("/*") || sql.includes("*/")) {
    return { ok: false, reason: "SQL comments are not allowed" };
  }
  if (!/^(select|with)\b/i.test(sql)) return { ok: false, reason: "Only SELECT or WITH queries are allowed" };
  if (FORBIDDEN_KEYWORDS.test(sql)) return { ok: false, reason: "The query contains a write/DDL keyword" };
  if (FORBIDDEN_FUNCTIONS.test(sql)) return { ok: false, reason: "The query contains a forbidden function" };

  const lower = sql.toLowerCase();
  for (const table of BLOCKED_TABLES) {
    if (new RegExp(`\\b${table}\\b`, "i").test(lower)) {
      return { ok: false, reason: `Table "${table}" is not readable through this console` };
    }
  }

  return { ok: true, sql };
}

type Row = Record<string, unknown>;

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "bigint") return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_COLUMN.test(k) ? "[redacted]" : sanitizeValue(v);
    }
    return out;
  }
  return value;
}

export function sanitizeRows(rows: Row[]): { rows: Row[]; redactedColumns: string[] } {
  const redacted = new Set<string>();
  const out = rows.map((row) => {
    const clean: Row = {};
    for (const [key, value] of Object.entries(row)) {
      if (SENSITIVE_COLUMN.test(key)) {
        clean[key] = "[redacted]";
        redacted.add(key);
      } else {
        clean[key] = sanitizeValue(value);
      }
    }
    return clean;
  });
  return { rows: out, redactedColumns: [...redacted] };
}

export interface SqlResult {
  rowCount: number;
  rows: Row[];
  truncated: boolean;
  redactedColumns: string[];
}

/**
 * Runs a validated read-only query inside a READ ONLY transaction.
 * The query is wrapped so a hard LIMIT is always applied.
 */
export async function runReadOnlyQuery(rawSql: string, maxRows = SQL_DEFAULT_ROWS): Promise<SqlResult> {
  const validation = validateReadOnlySql(rawSql);
  if (!validation.ok) throw new Error(`SQL_REJECTED: ${validation.reason}`);

  const cap = Math.max(1, Math.min(maxRows || SQL_DEFAULT_ROWS, SQL_MAX_ROWS));
  const wrapped = `SELECT * FROM (${validation.sql}) AS operator_result LIMIT ${cap + 1}`;

  const rows = (await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '3000ms'");
    return tx.$queryRawUnsafe<Row[]>(wrapped);
  })) as Row[];

  let truncated = false;
  let data = rows;
  if (data.length > cap) {
    truncated = true;
    data = data.slice(0, cap);
  }

  const sanitized = sanitizeRows(data);
  let resultRows = sanitized.rows;

  // Keep the payload small enough for the model context and the browser.
  let serialized = JSON.stringify(resultRows);
  if (serialized.length > RESULT_MAX_CHARS) {
    truncated = true;
    while (resultRows.length > 1 && JSON.stringify(resultRows).length > RESULT_MAX_CHARS) {
      resultRows = resultRows.slice(0, Math.max(1, Math.floor(resultRows.length / 2)));
    }
    serialized = JSON.stringify(resultRows);
  }

  return {
    rowCount: resultRows.length,
    rows: resultRows,
    truncated,
    redactedColumns: sanitized.redactedColumns,
  };
}
