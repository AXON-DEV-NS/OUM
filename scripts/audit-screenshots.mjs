/**
 * Visual audit crawler — captures full-page screenshots of every route at
 * desktop (1920×1080) and mobile (390×844) viewports.
 *
 * Auth:
 *  - Creator: a signed `session` JWT cookie is minted with NEXTAUTH_SECRET
 *    (stateless verification path — same claims the platform issues).
 *  - Owner: real login through POST /api/admin/auth/login with a computed
 *    TOTP code; the resulting `admin_session` cookie is reused.
 *
 * Usage: node scripts/audit-screenshots.mjs
 * Output: ./audit-screenshots/<route>-<viewport>.png
 */
import { chromium } from "playwright";
import { SignJWT } from "jose";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.AUDIT_BASE_URL || "http://localhost:3000";
const OUT_DIR = path.resolve("audit-screenshots");
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "LocalAuditPass2026!";
const ADMIN_TOTP_SECRET = process.env.ADMIN_TOTP_SECRET;
const TICKET_ID = process.env.AUDIT_TICKET_ID || "";

const VIEWPORTS = {
  desktop: { viewport: { width: 1920, height: 1080 }, isMobile: false, hasTouch: false },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};

const ROUTES = [
  // Marketing
  { path: "/", name: "01-landing", group: "marketing" },
  { path: "/pricing", name: "02-pricing", group: "marketing" },
  { path: "/blog", name: "03-blog", group: "marketing" },
  { path: "/blog/autonomous-youtube-studio-2026", name: "04-blog-article", group: "marketing" },
  { path: "/contact", name: "05-contact", group: "marketing" },
  { path: "/legal/privacy", name: "06-legal-privacy", group: "marketing" },
  { path: "/legal/terms", name: "07-legal-terms", group: "marketing" },
  { path: "/legal/refund", name: "08-legal-refund", group: "marketing" },
  { path: "/legal/cancellation", name: "09-legal-cancellation", group: "marketing" },
  // Auth & checkout
  { path: "/login", name: "10-login", group: "auth" },
  { path: "/checkout", name: "11-checkout", group: "auth", auth: "user" },
  { path: "/login?mode=signup", name: "11b-signup", group: "auth" },
  // Creator dashboard
  { path: "/dashboard", name: "12-dashboard", group: "app", auth: "user" },
  { path: "/onboarding", name: "13-onboarding", group: "app", auth: "user" },
  { path: "/channels/connect", name: "14-channels-connect", group: "app", auth: "user" },
  { path: "/niche", name: "15-niche", group: "app", auth: "user" },
  { path: "/content-calendar", name: "16-content-calendar", group: "app", auth: "user" },
  { path: "/analytics", name: "17-analytics", group: "app", auth: "user" },
  { path: "/settings", name: "18-settings", group: "app", auth: "user" },
  { path: "/support", name: "19-support", group: "app", auth: "user" },
  ...(TICKET_ID
    ? [{ path: `/support/${TICKET_ID}`, name: "20-support-ticket", group: "app", auth: "user" }]
    : []),
  // Admin gateway
  { path: "/oum-hq-secure-gateway/login", name: "21-admin-login", group: "admin" },
  { path: "/oum-hq-secure-gateway/overview", name: "22-admin-overview", group: "admin", auth: "admin" },
  { path: "/oum-hq-secure-gateway/users", name: "23-admin-users", group: "admin", auth: "admin" },
  { path: "/oum-hq-secure-gateway/plans", name: "24-admin-plans", group: "admin", auth: "admin" },
  { path: "/oum-hq-secure-gateway/promo-codes", name: "25-admin-promo-codes", group: "admin", auth: "admin" },
  { path: "/oum-hq-secure-gateway/finance", name: "26-admin-finance", group: "admin", auth: "admin" },
  { path: "/oum-hq-secure-gateway/audit-logs", name: "27-admin-audit-logs", group: "admin", auth: "admin" },
  { path: "/oum-hq-secure-gateway/security-chat", name: "28-admin-security-chat", group: "admin", auth: "admin" },
  // Error surface
  { path: "/this-route-does-not-exist-404", name: "29-not-found", group: "error" },
];

// ── TOTP (RFC 6238, SHA-1, 6 digits, 30s) ───────────────────────────────────
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
  const bin =
    ((hmac[off] & 0x7f) << 24) |
    ((hmac[off + 1] & 0xff) << 16) |
    ((hmac[off + 2] & 0xff) << 8) |
    (hmac[off + 3] & 0xff);
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
  if (!res.ok || !body.success) {
    throw new Error(`Admin login failed (${res.status}): ${JSON.stringify(body)}`);
  }
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const adminCookie = setCookie.map((c) => c.split(";")[0]).find((c) => c.startsWith("admin_session="));
  if (!adminCookie) throw new Error("admin_session cookie not returned");
  const [, value] = adminCookie.split("=");
  return { name: "admin_session", value, domain: "localhost", path: "/" };
}

/** Kills decorative overlays so screenshots show the real page. */
async function settle(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[aria-label="Welcome to OUM"], [aria-label="OUM"]')) {
      el.remove();
    }
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[aria-label="Welcome to OUM"], [aria-label="OUM"]')) {
      el.remove();
    }
  });
  await page.waitForTimeout(350);
}

const SKIP_EXISTING = process.env.AUDIT_SKIP_EXISTING === "1";

async function capture(browser, route, vpName, userCookie, adminCookie) {
  const file = path.join(OUT_DIR, `${route.name}-${vpName}.png`);
  if (SKIP_EXISTING && fs.existsSync(file)) {
    console.log(`${route.name.padEnd(24)} ${vpName.padEnd(8)} SKIP (exists)`);
    return { route: route.name, vp: vpName, status: "skipped", finalUrl: "", consoleErrors: [] };
  }

  const context = await browser.newContext({
    ...VIEWPORTS[vpName],
    locale: "en-US",
    timezoneId: "UTC",
    reducedMotion: "reduce",
  });
  if (route.auth === "user" && userCookie) await context.addCookies([userCookie]);
  if (route.auth === "admin" && adminCookie) await context.addCookies([adminCookie]);

  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300));
  });
  page.on("pageerror", (err) => consoleErrors.push(`PAGEERROR: ${String(err).slice(0, 300)}`));

  let status = "ok";
  let finalUrl = "";
  try {
    const res = await page.goto(`${BASE}${route.path}`, {
      waitUntil: "domcontentloaded",
      timeout: 240_000,
    });
    status = res ? String(res.status()) : "?";
    await page.waitForLoadState("networkidle", { timeout: 25_000 }).catch(() => {});
    await settle(page);
    finalUrl = page.url();
    await page.screenshot({ path: file, fullPage: true, animations: "disabled" });
  } catch (err) {
    status = `ERROR ${String(err).slice(0, 160)}`;
    await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  }
  await context.close();

  const redirected = finalUrl && !finalUrl.includes(route.path) ? ` → ${finalUrl}` : "";
  console.log(
    `${route.name.padEnd(24)} ${vpName.padEnd(8)} HTTP ${status}${redirected}` +
      (consoleErrors.length ? `\n    console errors: ${consoleErrors.slice(0, 3).join(" | ")}` : "")
  );
  return { route: route.name, vp: vpName, status, finalUrl, consoleErrors };
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const userCookie = await mintUserSessionCookie();
  let adminCookie = null;
  try {
    adminCookie = await adminLogin();
    console.log("Admin login OK — admin_session cookie acquired.");
  } catch (err) {
    console.warn("Admin login failed — admin panel captures will show the login gate:", err.message);
  }

  const browser = await chromium.launch();
  const results = [];
  for (const route of ROUTES) {
    for (const vpName of Object.keys(VIEWPORTS)) {
      results.push(await capture(browser, route, vpName, userCookie, adminCookie));
    }
  }
  await browser.close();

  fs.writeFileSync(path.join(OUT_DIR, "crawl-report.json"), JSON.stringify(results, null, 2));
  const failures = results.filter((r) => r.consoleErrors?.length);
  console.log(`\nDone. ${results.length} screenshots in ${OUT_DIR}`);
  if (failures.length) {
    console.log(`${failures.length} captures logged console errors (see crawl-report.json).`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
