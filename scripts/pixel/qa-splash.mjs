/**
 * Welcome splash capture — the one-time overlay depends on the per-account
 * `welcomeSeenAt` flag, so this script (a) clears it, (b) captures the overlay
 * at 390 and 1440, (c) restores it exactly as it was.
 *
 * Usage: node scripts/pixel/qa-splash.mjs   (server must be running)
 */
import { chromium } from "playwright";
import { SignJWT } from "jose";
import { PrismaClient } from "@prisma/client";
import path from "node:path";

const BASE = process.env.PIXEL_BASE_URL || "http://localhost:3000";
const OUT = path.resolve("pixel-qa/states");
const USER_ID = "demo-creator-001";

const prisma = new PrismaClient();
const before = await prisma.user.findUnique({
  where: { id: USER_ID },
  select: { welcomeSeenAt: true },
});
if (!before) throw new Error(`user ${USER_ID} not found`);
await prisma.user.update({ where: { id: USER_ID }, data: { welcomeSeenAt: null } });
console.log(`welcomeSeenAt cleared (was ${before.welcomeSeenAt?.toISOString() ?? "null"})`);

try {
  const token = await new SignJWT({
    userId: USER_ID,
    email: "creator@oum.local",
    name: "Demo Creator",
    role: "USER",
    type: "session",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.NEXTAUTH_SECRET));
  const cookie = { name: "session", value: token, domain: "localhost", path: "/" };

  const browser = await chromium.launch();
  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ]) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      deviceScaleFactor: w < 500 ? 2 : 1,
    });
    await ctx.addCookies([cookie]);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 240_000 });
    await page.waitForSelector('[role="dialog"][aria-label="Welcome to OUM"]', {
      state: "visible",
      timeout: 40_000,
    });
    await page.waitForTimeout(900);
    await page.screenshot({
      path: path.join(OUT, `welcome-splash-${w}.png`),
      animations: "disabled",
    });
    console.log(`saved welcome-splash-${w}.png`);
    await ctx.close();
  }
  await browser.close();
} finally {
  await prisma.user.update({
    where: { id: USER_ID },
    data: { welcomeSeenAt: before.welcomeSeenAt ?? new Date() },
  });
  console.log(`welcomeSeenAt restored (${(before.welcomeSeenAt ?? new Date()).toISOString()})`);
  await prisma.$disconnect();
}
