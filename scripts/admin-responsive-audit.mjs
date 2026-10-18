/**
 * Admin gateway responsive audit.
 *
 * Logs in through the REAL admin API (password + TOTP), then captures every
 * admin page at six widths and reports per page/viewport:
 *   - horizontal overflow (document scrollWidth > viewport)
 *   - elements sticking out of the viewport
 *   - interactive targets smaller than 40px on touch widths
 *   - console errors
 *
 * Usage:
 *   AUDIT_BASE_URL=http://localhost:3100 node scripts/admin-responsive-audit.mjs
 * Output:
 *   audit-screenshots/admin/<route>--<viewport>.png + report.json
 */
import { chromium } from "playwright";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.AUDIT_BASE_URL || "http://localhost:3000";
const OUT_DIR = path.resolve("audit-screenshots/admin");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "LocalAuditPass2026!";
const ADMIN_TOTP_SECRET = process.env.ADMIN_TOTP_SECRET;

const VIEWPORTS = [
  { name: "360x800", width: 360, height: 800, mobile: true },
  { name: "390x844", width: 390, height: 844, mobile: true },
  { name: "768x1024", width: 768, height: 1024, mobile: false },
  { name: "1024x768", width: 1024, height: 768, mobile: false },
  { name: "1440x900", width: 1440, height: 900, mobile: false },
  { name: "1920x1080", width: 1920, height: 1080, mobile: false },
];

const ROUTES = [
  { path: "/oum-hq-secure-gateway/login", name: "00-login", auth: false },
  { path: "/oum-hq-secure-gateway/overview", name: "01-overview", auth: true },
  { path: "/oum-hq-secure-gateway/users", name: "02-users", auth: true },
  { path: "/oum-hq-secure-gateway/plans", name: "03-plans", auth: true },
  { path: "/oum-hq-secure-gateway/promo-codes", name: "04-promo-codes", auth: true },
  { path: "/oum-hq-secure-gateway/finance", name: "05-finance", auth: true },
  { path: "/oum-hq-secure-gateway/audit-logs", name: "06-audit-logs", auth: true },
  { path: "/oum-hq-secure-gateway/security-chat", name: "07-security-chat", auth: true },
];

// ── TOTP (RFC 6238, SHA-1, 6 digits, 30s) ────────────────────────────────────
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Decode(secret) {
  const clean = secret.replace(/[\s=]/g, "").toUpperCase();
  let buffer = 0;
  let bitsLeft = 0;
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

async function settle(page) {
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[aria-label="Welcome to OUM"], [aria-label="OUM"]')) el.remove();
    // Full-page captures would duplicate a sticky header mid-page; pin it to the top.
    const style = document.createElement("style");
    style.setAttribute("data-audit", "1");
    style.textContent = "header.sticky{position:static !important}";
    document.head.appendChild(style);
  });
  await page.waitForTimeout(250);
}

const MEASURE = () => {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const overflowing = [];
  const smallTargets = [];
  for (const el of document.querySelectorAll("body *")) {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1 || r.left < -1) {
      // ignore anything living inside a horizontal scroll container
      let parent = el.parentElement;
      let parentScrolls = false;
      while (parent) {
        if (/(auto|scroll)/.test(getComputedStyle(parent).overflowX)) {
          parentScrolls = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (!parentScrolls) {
        overflowing.push({
          tag: el.tagName.toLowerCase(),
          cls: String(el.className).slice(0, 90),
          text: (el.textContent || "").trim().slice(0, 60),
          right: Math.round(r.right),
          left: Math.round(r.left),
        });
      }
    }
    if (["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(el.tagName)) {
      if (r.width < 40 || r.height < 40) {
        smallTargets.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40),
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      }
    }
  }
  return {
    viewport: vw,
    scrollWidth: doc.scrollWidth,
    horizontalOverflow: doc.scrollWidth > vw + 1,
    overflowing: overflowing.slice(0, 12),
    smallTargets: smallTargets.slice(0, 12),
  };
};

async function main() {
  if (!ADMIN_TOTP_SECRET) throw new Error("ADMIN_TOTP_SECRET is required (source .env.local)");
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const adminCookie = await adminLogin();
  console.log("Admin login OK.");

  const browser = await chromium.launch();
  const report = [];

  for (const route of ROUTES) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.mobile,
        hasTouch: vp.mobile,
        deviceScaleFactor: 1,
        locale: "en-US",
        timezoneId: "UTC",
        reducedMotion: "reduce",
      });
      if (route.auth) await context.addCookies([adminCookie]);
      const page = await context.newPage();
      const consoleErrors = [];
      page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text().slice(0, 200)));
      page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR: ${String(e).slice(0, 200)}`));

      let status = "?";
      try {
        const res = await page.goto(`${BASE}${route.path}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
        status = res ? String(res.status()) : "?";
        await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
        await settle(page);
        const metrics = await page.evaluate(MEASURE);
        const file = path.join(OUT_DIR, `${route.name}--${vp.name}.png`);
        await page.screenshot({ path: file, fullPage: true, animations: "disabled" });
        report.push({ route: route.name, path: route.path, vp: vp.name, status, ...metrics, consoleErrors });
        const flags = [
          metrics.horizontalOverflow ? `OVERFLOW +${metrics.scrollWidth - metrics.viewport}px` : "",
          metrics.overflowing.length ? `${metrics.overflowing.length} out-of-view` : "",
          metrics.smallTargets.length ? `${metrics.smallTargets.length} small-targets` : "",
          consoleErrors.length ? `${consoleErrors.length} console-errors` : "",
        ].filter(Boolean);
        console.log(
          `${route.name.padEnd(18)} ${vp.name.padEnd(9)} HTTP ${status}${flags.length ? " — " + flags.join(", ") : ""}`,
        );
      } catch (err) {
        report.push({ route: route.name, vp: vp.name, status: `ERROR ${String(err).slice(0, 160)}` });
        console.log(`${route.name.padEnd(18)} ${vp.name.padEnd(9)} ERROR ${String(err).slice(0, 120)}`);
      }
      await context.close();
    }
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  const bad = report.filter(
    (r) => r.horizontalOverflow || (r.overflowing?.length ?? 0) > 0 || (r.consoleErrors?.length ?? 0) > 0,
  );
  console.log(`\n${report.length} captures · ${bad.length} with layout/console problems`);
  console.log(`Report: ${path.join(OUT_DIR, "report.json")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
