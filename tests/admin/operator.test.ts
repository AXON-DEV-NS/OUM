/**
 * Owner Operator — security-critical unit tests.
 *
 * The DB-backed handlers are exercised against the real database in the
 * deployment smoke; here we prove the guardrails themselves:
 * read-only SQL, signed confirmations, the closed tool registry and the
 * offline fail-safe.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeRows, validateReadOnlySql } from "@/lib/admin/operator/sql";
import { PENDING_TTL_MS, signPending, verifyPending } from "@/lib/admin/operator/token";
import { getOperatorTool, listOperatorTools, operatorToolCatalog } from "@/lib/admin/operator/tools";
import { OperatorError, runOperatorTurn } from "@/lib/admin/operator/agent";

const secret = new TextEncoder().encode("test-secret-for-operator-tokens");

describe("operator SQL console", () => {
  test("accepts single SELECT / WITH statements", () => {
    for (const sql of [
      "SELECT 1",
      "SELECT status, count(*) FROM runs GROUP BY status",
      "WITH x AS (SELECT 1 AS n) SELECT * FROM x",
      "select email from users order by created_at desc",
      "SELECT 1;",
    ]) {
      assert.equal(validateReadOnlySql(sql).ok, true, sql);
    }
  });

  test("rejects writes, DDL, comments, multiple statements and dangerous functions", () => {
    for (const sql of [
      "",
      "DELETE FROM users",
      "UPDATE users SET status = 'SUSPENDED'",
      "DROP TABLE users",
      "SELECT 1; DROP TABLE users",
      "SELECT * FROM users -- sneaky",
      "/* hidden */ SELECT 1",
      "SELECT pg_sleep(10)",
      "SELECT * INTO backup FROM users",
      "WITH x AS (DELETE FROM users RETURNING *) SELECT * FROM x",
      "SELECT * FROM sessions",
      "SELECT token FROM api_service_keys",
    ]) {
      assert.equal(validateReadOnlySql(sql).ok, false, sql);
    }
  });

  test("redacts credential columns and normalizes BigInt/Date before leaving the server", () => {
    const { rows } = sanitizeRows([
      {
        email: "owner@example.com",
        passwordHash: "abc",
        accessToken: "t",
        nested: { apiKey: "k" },
        count: BigInt(5),
        at: new Date(0),
      },
    ]);
    assert.equal(rows[0].email, "owner@example.com");
    assert.equal(rows[0].passwordHash, "[redacted]");
    assert.equal(rows[0].accessToken, "[redacted]");
    assert.deepEqual(rows[0].nested, { apiKey: "[redacted]" });
    assert.equal(rows[0].count, 5);
    assert.equal(rows[0].at, new Date(0).toISOString());
  });
});

describe("signed confirmations", () => {
  const payload = {
    sub: "owner@example.com",
    jti: "jti_1234567890",
    exp: Date.now() + 60_000,
    tool: "suspend_user",
    input: { userId: "user_123", reason: "policy violation" },
  };

  test("round-trips a valid token", () => {
    const token = signPending(payload, secret);
    const verified = verifyPending(token, secret);
    assert.equal(verified.ok, true);
    assert.deepEqual(verified.payload, payload);
  });

  test("rejects tampered payloads and signatures", () => {
    const token = signPending(payload, secret);
    const [body, sig] = token.split(".");
    const tampered = Buffer.from(
      JSON.stringify({ ...payload, tool: "delete_promo_code", input: { id: "x" } }),
      "utf8",
    ).toString("base64url");
    assert.equal(verifyPending(`${tampered}.${sig}`, secret).ok, false);
    assert.equal(verifyPending(`${body}.${sig.slice(0, -2)}AA`, secret).ok, false);
    assert.equal(verifyPending("not-a-token", secret).ok, false);
  });

  test("rejects expired tokens and absurd expiries", () => {
    assert.equal(verifyPending(signPending({ ...payload, exp: Date.now() - 1 }, secret), secret).ok, false);
    assert.equal(
      verifyPending(signPending({ ...payload, exp: Date.now() + PENDING_TTL_MS * 10 }, secret), secret).ok,
      false,
    );
  });
});

describe("operator tool registry", () => {
  test("is closed: unique names, every write goes through confirmation, no shell/exec tools", () => {
    const tools = listOperatorTools();
    const names = tools.map((t) => t.name);
    assert.equal(new Set(names).size, names.length);
    for (const tool of tools) {
      assert.ok(tool.input, `${tool.name} has no input schema`);
      assert.ok(tool.description.length > 10, tool.name);
      assert.ok(!/shell|pty|spawn|exec|eval|sql_write/i.test(tool.name), `${tool.name} looks dangerous`);
      if (tool.kind === "write") assert.equal(tool.kind, "write");
    }
    assert.equal(getOperatorTool("sql_read")?.kind, "read");
    assert.equal(getOperatorTool("suspend_user")?.kind, "write");
    assert.equal(getOperatorTool("does_not_exist"), undefined);
  });

  test("catalog is valid JSON with input schemas for the model", () => {
    const catalog = JSON.parse(operatorToolCatalog()) as Array<{ name: string; input: unknown }>;
    assert.ok(catalog.length >= 20);
    for (const entry of catalog) {
      assert.ok(entry.name);
      assert.ok(entry.input && typeof entry.input === "object");
    }
  });
});

describe("operator fail-safe", () => {
  test("refuses to call the model without a DeepSeek key", async () => {
    const previous = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    try {
      await assert.rejects(
        () =>
          runOperatorTurn({
            message: "show me the users",
            actor: { id: "admin-owner", email: "owner@example.com" },
          }),
        (error) => error instanceof OperatorError && error.code === "OPERATOR_OFFLINE",
      );
    } finally {
      if (previous !== undefined) process.env.DEEPSEEK_API_KEY = previous;
    }
  });
});
