/**
 * Pixel edge audit — automated DOM scanner.
 *
 * Fails (reports) any visible edge that is NOT the pixel system:
 *   1. border-radius > 0 on a rendered element (smooth corner)
 *   2. box-shadow / drop-shadow with a non-zero blur (smooth shadow edge)
 *   3. a visible border (width > 0, opaque colour, solid style) whose
 *      border-image-source is none (leftover smooth border)
 *   4. border-image applied but with a non-4px width or missing slice
 *
 * Exemptions (by design):
 *   - decorative glow blobs (.blur-2xl / .blur-3xl) keep their round blur
 *   - clipped shapes (.px-circle / round avatars) own their silhouette
 *   - transparent / border-0 elements render no edge at all
 *
 * Usage:
 *   node scripts/pixel/audit-edges.mjs                 # default route list
 *   AUDIT_ONLY=home,dashboard node scripts/pixel/audit-edges.mjs
 * Output: pixel-qa/edge-audit.json + console report
 */
import { chromium } from "playwright";
import { SignJWT } from "jose";
import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.PIXEL_BASE_URL || "http://localhost:3000";
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "LocalAuditPass2026!";
const ADMIN_TOTP_SECRET = process.env.ADMIN_TOTP_SECRET;
const TICKET_ID = process.env.AUDIT_TICKET_ID || "";

const ONLY = (process.env.AUDIT_ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);

const ROUTES = [
  { path: "/", name: "home" },
  { path: "/pricing", name: "pricing" },
  { path: "/blog", name: "blog" },
  { path: "/blog/autonomous-youtube-studio-2026", name: "article" },
  { path: "/contact", name: "contact" },
  { path: "/login", name: "login" },
  { path: "/legal/privacy", name: "privacy" },
  { path: "/legal/terms", name: "terms" },
  { path: "/legal/refund", name: "refund" },
  { path: "/legal/cancellation", name: "cancellation" },
  { path: "/checkout", name: "checkout", auth: "user" },
  { path: "/dashboard", name: "dashboard", auth: "user" },
  { path: "/onboarding", name: "onboarding", auth: "user" },
  { path: "/content-calendar", name: "calendar", auth: "user" },
  { path: "/niche", name: "niche", auth: "user" },
  { path: "/channels/connect", name: "connect-channel", auth: "user" },
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
  { path: "/oum-hq-secure-gateway", name: "admin-index", auth: "admin" },
  { path: "/this-route-does-not-exist-404", name: "not-found" },
];

/* ── TOTP ── */
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

/** Runs in the page: returns every offending edge with a readable reason. */
function scanDocument() {
  const BLUR_EXEMPT = (cls) => cls.includes("blur-2xl") || cls.includes("blur-3xl");
  const out = [];
  const seen = new Set();
  const push = (entry) => {
    const key = entry.reason + "|" + entry.cls.slice(0, 80);
    if (seen.has(key) || out.length >= 220) return;
    seen.add(key);
    out.push(entry);
  };

  const describe = (el, reason, value) => ({
    reason,
    value,
    tag: el.tagName.toLowerCase(),
    cls: String(el.className || "").slice(0, 110),
    sample: (el.textContent || "").trim().slice(0, 42).replace(/\s+/g, " "),
  });

  for (const el of document.querySelectorAll("body *")) {
    if (el.closest("[data-pixel-audit-skip]")) continue;
    const cs = getComputedStyle(el);
    const cls = String(el.className || "");
    if (BLUR_EXEMPT(cls)) continue;

    /* 1 · smooth corner */
    if (cs.borderRadius && cs.borderRadius !== "0px" && !/^0px( 0px)*$/.test(cs.borderRadius)) {
      push(describe(el, "radius", cs.borderRadius));
    }

    /* 2 · smooth shadow (non-zero blur) */
    const sh = cs.boxShadow;
    if (sh && sh !== "none") {
      for (const part of sh.split(/,(?![^()]*\))/)) {
        const m = part.match(/(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/);
        if (m && Number(m[3]) > 0) push(describe(el, "shadow-blur", part.trim().slice(0, 64)));
      }
    }
    const filter = cs.filter;
    if (filter && filter !== "none") {
      const dm = filter.match(/drop-shadow\([^)]*\)/g) || [];
      for (const d of dm) {
        const m = d.match(/-?[\d.]+px\s+-?[\d.]+px\s+([\d.]+)px/);
        if (m && Number(m[1]) > 0) push(describe(el, "drop-shadow-blur", d.slice(0, 64)));
      }
      if (/blur\((\d|\.\d+)/.test(filter) && !BLUR_EXEMPT(cls)) {
        push(describe(el, "filter-blur", filter.slice(0, 48)));
      }
    }

    /* 3 · visible border without a pixel frame */
    const widths = [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth];
    const colors = [cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor];
    const styles = [cs.borderTopStyle, cs.borderRightStyle, cs.borderBottomStyle, cs.borderLeftStyle];
    const visibleBorder = widths.some((w, i) => parseFloat(w) > 0 && styles[i] !== "none" && !/rgba?\([^)]*,\s*0\)$/.test(colors[i]) && colors[i] !== "transparent");
    if (visibleBorder && cs.borderImageSource === "none") {
      push(describe(el, "border-without-frame", `${widths.join(" ")} ${colors[0]}`));
    }

    /* 4 · frame geometry drift */
    if (cs.borderImageSource !== "none") {
      if (cs.borderImageWidth.replace(/\s+/g, " ") !== "4px") {
        push(describe(el, "frame-width", cs.borderImageWidth));
      }
      if (cs.borderImageSlice.replace(/\s+/g, " ").split(" ")[0] !== "4") {
        push(describe(el, "frame-slice", cs.borderImageSlice));
      }
    }

    /* 5 · pseudo-element edges (the known decorative ones) */
    if (/eyebrow|link-underline|grain-overlay|footer-link|testimonial/.test(cls)) {
      for (const pe of ["::before", "::after"]) {
        const ps = getComputedStyle(el, pe);
        if (ps.borderRadius && ps.borderRadius !== "0px") push(describe(el, `radius${pe}`, ps.borderRadius));
        const psh = ps.boxShadow;
        if (psh && psh !== "none") {
          const m = psh.match(/(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/);
          if (m && Number(m[3]) > 0) push(describe(el, `shadow-blur${pe}`, psh.slice(0, 56)));
        }
      }
    }
  }
  return out;
}

async function main() {
  const userCookie = await mintUserSessionCookie();
  const routes = ONLY.length ? ROUTES.filter((r) => ONLY.includes(r.name)) : ROUTES;
  let adminCookie = null;
  if (routes.some((r) => r.auth === "admin")) adminCookie = await adminLogin();

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  await context.addCookies([userCookie, ...(adminCookie ? [adminCookie] : [])]);
  const page = await context.newPage();

  const report = {};
  let total = 0;
  for (const route of routes) {
    try {
      await page.goto(`${BASE}${route.path}`, { waitUntil: "domcontentloaded", timeout: 240_000 });
      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
      await page.evaluate(() => {
        for (const el of document.querySelectorAll('[aria-label="Welcome to OUM"], [aria-label="OUM"]')) el.remove();
      });
      await page.waitForTimeout(600);
      const findings = await page.evaluate(scanDocument);
      report[route.name] = findings;
      total += findings.length;
      const reasons = findings.reduce((acc, f) => ((acc[f.reason] = (acc[f.reason] || 0) + 1), acc), {});
      const flag = findings.length ? "✗" : "✓";
      console.log(`${flag} ${route.name.padEnd(15)} ${findings.length ? JSON.stringify(reasons) : "clean"}`);
    } catch (err) {
      report[route.name] = [{ reason: "scan-error", value: String(err).slice(0, 120) }];
      total += 1;
      console.log(`! ${route.name.padEnd(15)} ERROR ${String(err).slice(0, 100)}`);
    }
  }
  const outPath = path.resolve("pixel-qa/edge-audit.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ total, report }, null, 2));
  console.log(`\nTOTAL FINDINGS: ${total}  →  ${outPath}`);
  await browser.close();
  process.exitCode = total > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
