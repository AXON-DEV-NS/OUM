const { chromium } = require("playwright-core");
const path = require("path");

(async () => {
  const exe = "C:\\Users\\Maka\\AppData\\Local\\ms-playwright\\chromium-1248\\chrome-win\\chrome.exe";
  const browser = await chromium.launch({ executablePath: exe });
  const page = await browser.newPage({ viewport: { width: 3840, height: 2160 } });
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + String(e).slice(0, 200)));
  const file = "file:///" + path.resolve("video/oum-intro/index.html").replace(/\\/g, "/");
  await page.goto(file, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500);
  const hasSeek = await page.evaluate(() => !!(window.hyperframes && window.hyperframes.seek));
  const hasTl = await page.evaluate(() => !!(window.__timelines && window.__timelines["oum-intro"]));
  console.log("seek-hook:", hasSeek, "| timeline:", hasTl);
  for (const t of [1.7, 14, 28]) {
    await page.evaluate((tt) => window.hyperframes.seek(tt), t);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `out/validate-t${String(t).replace(".", "p")}.png` });
    console.log("shot t=" + t);
  }
  console.log("console errors:", errors.length ? errors : "none");
  await browser.close();
})().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
