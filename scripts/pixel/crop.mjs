/**
 * Element crop shot — close-up inspection of a single element at high DPR.
 * Usage: node scripts/pixel/crop.mjs <path> <selector> <out.png> [dpr] [auth]
 */
import { chromium } from "playwright";
import { SignJWT } from "jose";
import fs from "node:fs";
import path from "node:path";

const [, , routePath, selector, out, dprArg, auth] = process.argv;
const BASE = process.env.PIXEL_BASE_URL || "http://localhost:3000";
const DPR = Number(dprArg || 3);
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;

async function userCookie() {
  const token = await new SignJWT({ userId: "demo-creator-001", email: "creator@oum.local", name: "Demo Creator", role: "USER", type: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(new TextEncoder().encode(NEXTAUTH_SECRET));
  return { name: "session", value: token, domain: "localhost", path: "/" };
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DPR, reducedMotion: "reduce" });
if (auth === "user") await context.addCookies([await userCookie()]);
const page = await context.newPage();
await page.goto(`${BASE}${routePath}`, { waitUntil: "domcontentloaded", timeout: 240_000 });
await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
await page.evaluate(() => {
  for (const el of document.querySelectorAll('[aria-label="Welcome to OUM"], [aria-label="OUM"]')) el.remove();
});
await page.waitForTimeout(700);
const el = page.locator(selector).first();
await el.scrollIntoViewIfNeeded().catch(() => {});
await page.waitForTimeout(300);
const file = path.resolve(out);
fs.mkdirSync(path.dirname(file), { recursive: true });
await el.screenshot({ path: file, animations: "disabled" });
console.log(`saved ${file}`);
await browser.close();
