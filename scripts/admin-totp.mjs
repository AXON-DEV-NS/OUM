#!/usr/bin/env node
/**
 * Prints the current 6-digit owner 2FA code from ADMIN_TOTP_SECRET in
 * .env.local — the same RFC 6238 / SHA-1 / 30 s algorithm as
 * lib/admin/totp.ts, so the code always matches the admin login.
 *
 * Usage:
 *   node scripts/admin-totp.mjs          # current code
 *   node scripts/admin-totp.mjs --uri    # otpauth:// URI to import into
 *                                        # Google Authenticator / 1Password
 */
import fs from "node:fs";
import path from "node:path";
import { createHmac } from "node:crypto";

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const ENV_PATH = path.join(import.meta.dirname, "..", ".env.local");

function envValue(key) {
  if (!fs.existsSync(ENV_PATH)) {
    console.error(`Missing ${ENV_PATH}`);
    process.exit(1);
  }
  const line = fs
    .readFileSync(ENV_PATH, "utf8")
    .split("\n")
    .find((l) => l.trimStart().startsWith(`${key}=`));
  if (!line) return null;
  return line
    .trim()
    .slice(key.length + 1)
    .trim()
    .replace(/^["']|["']$/g, "");
}

function base32Decode(secret) {
  const clean = secret.replace(/[\s=]/g, "").toUpperCase();
  let buffer = 0;
  let bitsLeft = 0;
  const bytes = [];
  for (const char of clean) {
    const value = B32.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 5) | value;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      bytes.push((buffer >> (bitsLeft - 8)) & 0xff);
      bitsLeft -= 8;
    }
  }
  return Buffer.from(bytes);
}

function codeFor(key, counter) {
  const c = Buffer.alloc(8);
  c.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(c).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(bin % 1_000_000).padStart(6, "0");
}

const secret = envValue("ADMIN_TOTP_SECRET");
if (!secret) {
  console.error("ADMIN_TOTP_SECRET is not set in .env.local");
  process.exit(1);
}

if (process.argv.includes("--uri")) {
  const email = envValue("ADMIN_EMAIL") || "owner@vovo-agent.ai";
  const params = new URLSearchParams({
    secret,
    issuer: "VOVO Agent AI",
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });
  console.log(
    `otpauth://totp/${encodeURIComponent(`VOVO Agent AI:${email}`)}?${params}`
  );
  process.exit(0);
}

const now = Math.floor(Date.now() / 1000);
const remaining = 30 - (now % 30);
console.log(
  `Owner 2FA code: ${codeFor(base32Decode(secret), Math.floor(now / 30))}` +
    `   (expires in ${remaining}s)`
);
