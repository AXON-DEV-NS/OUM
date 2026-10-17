/**
 * Pixel edge QA — targeted screenshots for visual verification.
 *
 * Usage:
 *   node scripts/pixel/qa-shots.mjs                       # all shots, desktop+mobile
 *   PIXEL_SHOTS=home,dashboard node scripts/pixel/qa-shots.mjs
 *   PIXEL_VIEW=desktop node scripts/pixel/qa-shots.mjs
 *   PIXEL_FULL=0 node scripts/pixel/qa-shots.mjs          # viewport shots (fast)
 *   PIXEL_DPR=2 node scripts/pixel/qa-shots.mjs
 *
 * Output: pixel-qa/<name>-<vp>.png
 */
import { chromium } from "playwright";
import { SignJWT } from "jose";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.PIXEL_BASE_URL || "http://localhost:3000";
const OUT_DIR = path.resolve(process.env.PIXEL_OUT || "pixel-qa");
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "LocalAuditPass2026!";
const ADMIN_TOTP_SECRET = process.env.ADMIN_TOTP_SECRET;
const TICKET_ID = process.env.AUDIT_TICKET_ID || "";

const ONLY = (process.env.PIXEL_SHOTS || "").split(",").map((s) => s.trim()).filter(Boolean);
const VIEW = process.env.PIXEL_VIEW || "both";
const FULL = process.env.PIXEL_FULL !== "0";

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: Number(process.env.PIXEL_DPR || 1) },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: Number(process.env.PIXEL_DPR || 2), isMobile: true, hasTouch: true },
};

const SHOTS = [
  { path: "/", name: "home" },
  { path: "/pricing", name: "pricing" },
  { path: "/blog", name: "blog" },
  { path: "/blog/autonomous-youtube-studio-2026", name: "article" },
  { path: "/contact", name: "contact" },
  { path: "/login", name: "login" },
  { path: "/legal/privacy", name: "privacy" },
  { path: "/checkout", name: "checkout", auth: "user" },
  { path: "/dashboard", name: "dashboard", auth: "user" },
  { path: "/onboarding", name: "onboarding", auth: "user" },
  { path: "/content-calendar", name: "calendar", auth: "user" },
  { path: "/analytics", name: "analytics", auth: "user" },
  { path: "/settings", name: "settings", auth: "user" },
  { path: "/support", name: "support", auth: "user" },
  ...(TICKET_ID ? [{ path: `/support/${TICKET_ID}`, name: "ticket", auth: "user" }] : []),
  { path: "/oum-hq-secure-gateway/login", name: "admin-login" },
  { path: "/oum-hq-secure-gateway/overview", name: "admin-overview", auth: "admin" },
  { path: "/oum-hq-secure-gateway/users", name: "admin-users", auth: "admin" },
  { path: "/oum-hq-secure-gateway/plans", name: "admin-plans", auth: "admin" },
  { path: "/oum-hq-secure-gateway/promo-codes", name: "admin-promo", auth: "admin" },
  { path: "/oum-hq-secure-gateway/finance", name: "admin-finance", auth: "admin" },
  { path: "/oum-hq-secure-gateway/audit-logs", name: "admin-audit", auth: "admin" },
  { path: "/oum-hq-secure-gateway/security-chat", name: "admin-chat", auth: "admin" },
  { path: "/this-route-does-not-exist-404", name: "not-found" },
];

/* ── TOTP (RFC 6238, SHA-1, 6 digits, 30s) ── */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Decode(secret) {
  const clean = secret.replace(/[\s=]/g, "").toUpperCase();
  let buffer = 0, bitsLeft = 0;
  const bytes = [];
  for (const ch of clean) {
    const v = B32.indexOf(ch);
    if (v === -1) continue;
    buffer = (buffer << 5) | v;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      bytes.push((buffer >> (bitsLeft - 8)) & 0xff);
      bitsLeft -= 8;
    }
  }
  return Buffer.from(bytes);
}
function currentTotp(secret) {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(buf).digest();
  const off = hmac[hmac.length - 1] & 0x0f;
  const bin = ((hmac[off] & 0x7f) << 24) | ((hmac[off + 1] & 0xff) << 16) | ((hmac[off + 2] & 0xff) << 8) | (hmac[off + 3] & 0xff);
  return String(bin % 1_000_000).padStart(6, "0");
}

async function mintUserSessionCookie() {
  const token = await new SignJWT({
    userId: "demo-creator-001",
    email: "creator@oum.local",
    name: "Demo Creator",
    role: "USER",
    type: "session",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode(NEXTAUTH_SECRET));
  return { name: "session", value: token, domain: "localhost", path: "/" };
}

async function adminLogin() {
  const res = await fetch(`${BASE}/api/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: ADMIN_PASSWORD, code: currentTotp(ADMIN_TOTP_SECRET) }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) throw new Error(`Admin login failed (${res.status}): ${JSON.stringify(body)}`);
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const adminCookie = setCookie.map((c) => c.split(";")[0]).find((c) => c.startsWith("admin_session="));
  if (!adminCookie) throw new Error("admin_session cookie not returned");
  const [, value] = adminCookie.split("=");
  return { name: "admin_session", value, domain: "localhost", path: "/" };
}

async function settle(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[aria-label="Welcome to OUM"], [aria-label="OUM"]')) el.remove();
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[aria-label="Welcome to OUM"], [aria-label="OUM"]')) el.remove();
  });
  await page.waitForTimeout(300);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const userCookie = await mintUserSessionCookie();
  let adminCookie = null;
  if (SHOTS.some((s) => s.auth === "admin") && (ONLY.length === 0 || SHOTS.some((s) => ONLY.includes(s.name) && s.auth === "admin"))) {
    adminCookie = await adminLogin();
  }

  const browser = await chromium.launch();
  const views = VIEW === "both" ? ["desktop", "mobile"] : [VIEW];
  const shots = ONLY.length ? SHOTS.filter((s) => ONLY.includes(s.name)) : SHOTS;
  const report = [];

  for (const shot of shots) {
    for (const vp of views) {
      const file = path.join(OUT_DIR, `${shot.name}-${vp}.png`);
      const context = await browser.newContext({
        ...VIEWPORTS[vp],
        locale: "en-US",
        timezoneId: "UTC",
        reducedMotion: "reduce",
      });
      if (shot.auth === "user") await context.addCookies([userCookie]);
      if (shot.auth === "admin" && adminCookie) await context.addCookies([adminCookie]);
      const page = await context.newPage();
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200));
      });
      page.on("pageerror", (err) => consoleErrors.push(`PAGEERROR: ${String(err).slice(0, 200)}`));
      let status = "ok";
      try {
        const res = await page.goto(`${BASE}${shot.path}`, { waitUntil: "domcontentloaded", timeout: 240_000 });
        status = res ? String(res.status()) : "?";
        await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
        await settle(page);
        await page.screenshot({ path: file, fullPage: FULL, animations: "disabled" });
      } catch (err) {
        status = `ERROR ${String(err).slice(0, 140)}`;
        await page.screenshot({ path: file, fullPage: FULL }).catch(() => {});
      }
      await context.close();
      console.log(`${shot.name.padEnd(16)} ${vp.padEnd(8)} HTTP ${status}${consoleErrors.length ? `  ⚠ ${consoleErrors.slice(0, 2).join(" | ")}` : ""}`);
      report.push({ name: shot.name, vp, path: shot.path, status, consoleErrors });
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
