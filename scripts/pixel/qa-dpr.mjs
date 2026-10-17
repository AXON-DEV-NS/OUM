/**
 * DPR evidence crops — proves the 4px pixel edges stay crisp square pixels at
 * device pixel ratios 1 / 2 / 3 (integer geometry, no anti-aliased curves).
 *
 * Output: pixel-qa/crops/dpr{1,2,3}-{logo,cta}.png
 * Usage:  node scripts/pixel/qa-dpr.mjs   (server must be running)
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.PIXEL_BASE_URL || "http://localhost:3000";
const OUT = path.resolve("pixel-qa/crops");
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

for (const dpr of [1, 2, 3]) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: dpr,
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 240_000 });
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[aria-label="Welcome to OUM"], [aria-label="OUM"]')) el.remove();
  });
  await page.waitForTimeout(300);

  const pad = 6;
  const pairs = [
    { name: "logo", locator: page.locator('header img[alt="OUM logo"]').first() },
    { name: "cta", locator: page.locator("header a", { hasText: "Get Started" }).last() },
  ];
  for (const { name, locator } of pairs) {
    const box = await locator.boundingBox();
    if (!box) {
      console.log(`  ! dpr${dpr}-${name}: no bounding box`);
      continue;
    }
    await page.screenshot({
      path: path.join(OUT, `dpr${dpr}-${name}.png`),
      clip: {
        x: Math.max(0, box.x - pad),
        y: Math.max(0, box.y - pad),
        width: box.width + pad * 2,
        height: box.height + pad * 2,
      },
      animations: "disabled",
    });
    console.log(`  saved dpr${dpr}-${name}.png (${Math.round(box.width)}x${Math.round(box.height)} CSS px)`);
  }
  await ctx.close();
}

await browser.close();
