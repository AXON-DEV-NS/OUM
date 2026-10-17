/**
 * Pixel edge QA — interactive states + full breakpoint matrix.
 *
 * Captures (pixel-qa/states/, pixel-qa/matrix/):
 *   - mobile menu open (390)
 *   - video modal open (1440)
 *   - keyboard focus ring (Tab → CTA)
 *   - hover state on CTA
 *   - first-load branding / welcome splash (fresh context)
 *   - breakpoint matrix: 360x640 390x844 414x896 768x1024 1024x768 1366x768 1440x900 1920x1080
 *
 * Usage: node scripts/pixel/qa-states.mjs
 */
import { chromium } from "playwright";
import { SignJWT } from "jose";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.PIXEL_BASE_URL || "http://localhost:3000";
const OUT = path.resolve("pixel-qa");
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "LocalAuditPass2026!";
const ADMIN_TOTP_SECRET = process.env.ADMIN_TOTP_SECRET;

/* ── TOTP for the owner panel ── */
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
async function adminLogin() {
  const res = await fetch(`${BASE}/api/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: ADMIN_PASSWORD, code: currentTotp(ADMIN_TOTP_SECRET) }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) throw new Error(`Admin login failed (${res.status})`);
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const adminCookie = setCookie.map((c) => c.split(";")[0]).find((c) => c.startsWith("admin_session="));
  if (!adminCookie) throw new Error("admin_session cookie not returned");
  const [, value] = adminCookie.split("=");
  return { name: "admin_session", value, domain: "localhost", path: "/" };
}

async function userCookie() {
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

const settle = async (page, ms = 500) => {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[aria-label="Welcome to OUM"], [aria-label="OUM"]')) el.remove();
  });
  await page.waitForTimeout(ms);
};

const shot = async (page, name, full = false) => {
  fs.mkdirSync(path.dirname(path.join(OUT, name)), { recursive: true });
  await page.screenshot({ path: path.join(OUT, name), fullPage: full, animations: "disabled" });
  console.log(`  saved ${name}`);
};

async function main() {
  const browser = await chromium.launch();
  const cookie = await userCookie();
  const adminCookie = await adminLogin().catch((err) => {
    console.log(`  ! admin auth unavailable: ${String(err).slice(0, 80)}`);
    return null;
  });

  /* ── 1 · desktop states (home) ── */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 240_000 });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await settle(page);

    /* keyboard focus ring */
    let focused = false;
    for (let i = 0; i < 24 && !focused; i++) {
      await page.keyboard.press("Tab");
      focused = await page.evaluate(() => /Get Started/.test(document.activeElement?.textContent || ""));
    }
    await shot(page, "states/focus-cta-1440.png");
    await page.screenshot({ path: path.join(OUT, "states", "focus-cta-crop.png"), clip: { x: 1080, y: 0, width: 360, height: 64 } }).catch(() => {});

    /* hover state */
    const cta = page.locator("header a", { hasText: "Get Started" }).last();
    await cta.hover();
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(OUT, "states", "hover-cta-crop.png"), clip: { x: 1080, y: 0, width: 360, height: 64 } });

    /* video modal */
    const openBtn = page.locator("main a, main button", { hasText: /See how it works|how it works/i }).first();
    await openBtn.click({ timeout: 10_000 }).catch(async () => {
      await page.getByText(/See how it works/i).first().click({ timeout: 10_000 });
    });
    await page.waitForTimeout(900);
    await shot(page, "states/video-modal-1440.png");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await ctx.close();
  }

  /* ── 2 · mobile menu open (390) ── */
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 240_000 });
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await settle(page);
    await page.locator('[aria-label="Toggle menu"]').first().click();
    await page.waitForTimeout(600);
    await shot(page, "states/mobile-menu-390.png");
    await ctx.close();
  }

  /* ── 3 · first-load branding / splash (fresh context, animations on) ── */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    await ctx.addCookies([cookie]);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 240_000 });
    await page.waitForTimeout(350);
    await shot(page, "states/first-load-branding.png");
    await page.waitForTimeout(1800);
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 240_000 });
    await page.waitForTimeout(320);
    await shot(page, "states/welcome-splash-390.png");
    await page.waitForTimeout(2400);
    await ctx.close();
  }

  /* ── 4 · breakpoint matrix ── */
  const SIZES = [
    [360, 640],
    [390, 844],
    [414, 896],
    [768, 1024],
    [1024, 768],
    [1366, 768],
    [1440, 900],
    [1920, 1080],
  ];
  const MATRIX_ROUTES = [
    { path: "/", name: "home", auth: false },
    { path: "/pricing", name: "pricing", auth: false },
    { path: "/dashboard", name: "dashboard", auth: true },
    { path: "/oum-hq-secure-gateway/overview", name: "admin", auth: false, admin: true },
  ];
  for (const [w, h] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    await ctx.addCookies([cookie, ...(adminCookie ? [adminCookie] : [])]);
    const page = await ctx.newPage();
    for (const route of MATRIX_ROUTES) {
      try {
        await page.goto(`${BASE}${route.path}`, { waitUntil: "domcontentloaded", timeout: 240_000 });
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
        await settle(page, 400);
        await page.screenshot({
          path: path.join(OUT, "matrix", `${route.name}-${w}x${h}.png`),
          fullPage: false,
          animations: "disabled",
        });
        console.log(`  saved matrix/${route.name}-${w}x${h}.png`);
      } catch (err) {
        console.log(`  ! matrix/${route.name}-${w}x${h}: ${String(err).slice(0, 90)}`);
      }
    }
    await ctx.close();
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
