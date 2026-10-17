/**
 * Focused re-captures:
 *   1. FirstLoadBranding overlay (PipelineLoader with the new mark) — waits
 *      for [role="status"] so it is caught deterministically.
 *   2. Dashboard with DATA loaded (replaces skeleton frames in the matrix).
 *
 * Usage: node scripts/pixel/qa-branding.mjs
 */
import { chromium } from "playwright";
import { SignJWT } from "jose";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.PIXEL_BASE_URL || "http://localhost:3000";
const OUT = path.resolve("pixel-qa");

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
  .sign(new TextEncoder().encode(process.env.NEXTAUTH_SECRET));
const cookie = { name: "session", value: token, domain: "localhost", path: "/" };

const browser = await chromium.launch();

/* ── 1 · first-load branding overlay ── */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([cookie]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 240_000 });
  await page.waitForSelector('[role="status"]', { state: "visible", timeout: 30_000 });
  await page.screenshot({ path: path.join(OUT, "states/first-load-branding.png") });
  console.log("saved states/first-load-branding.png");
  await ctx.close();
}

/* ── 2 · loaded dashboard at 4 sizes ── */
for (const [w, h] of [
  [360, 640],
  [390, 844],
  [768, 1024],
  [1440, 900],
]) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  await ctx.addCookies([cookie]);
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 240_000 });
    await page.getByText("Welcome back", { exact: false }).first().waitFor({ timeout: 40_000 });
    await page.waitForTimeout(4_000); // let the stats/content settle
    const name = `matrix/dashboard-${w}x${h}.png`;
    await page.screenshot({ path: path.join(OUT, name), animations: "disabled" });
    console.log(`saved ${name}`);
  } catch (err) {
    console.log(`! dashboard-${w}x${h}: ${String(err).slice(0, 100)}`);
  }
  await ctx.close();
}

await browser.close();
