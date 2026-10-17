#!/usr/bin/env node
/**
 * OUM brand asset generator — favicon set + app icons + OG image + page mark.
 *
 * Source of truth: the REAL site logo, public/oum.png (1200x896 RGBA).
 * Every emitted asset is a crop/scale of that exact artwork — nothing is
 * redrawn or approximated.
 *
 * Emits (public/):
 *   oum-logo.png            — tight transparent crop of oum.png (page lockups)
 *   favicon.ico             — 16 + 32 + 48 (PNG-embedded ICO)
 *   icon-32.png             — 32
 *   icon-192.png            — 192 (manifest + email header)
 *   icon-512.png            — 512 (manifest + JSON-LD)
 *   icon-maskable-512.png   — 512, robot at 80% on cream (manifest maskable)
 *   apple-touch-icon.png    — 180, cream background (iOS ignores alpha)
 *   og.png                  — 1200x630 social card
 * Emits (app/):
 *   icon.png                — 512 (Next file-based favicon)
 *   apple-icon.png          — 180 (Next file-based Apple icon)
 *
 * Also removes legacy redrawn assets if present (oum-mark.png, icon.svg,
 * favicon-32.png) so only real-logo-derived files remain.
 *
 * Usage: node scripts/pixel/gen-icons.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const PUB = path.join(ROOT, "public");
const APP = path.join(ROOT, "app");
const MASTER = path.join(PUB, "oum.png");

const CREAM = "#F5EFE1";
const INK = "#1B1915";
const GREEN = "#416B41";

/* ── ICO container (PNG-embedded entries) ── */
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = Buffer.alloc(16 * pngs.length);
  let offset = 6 + 16 * pngs.length;
  pngs.forEach(({ size, buf }, i) => {
    const e = 16 * i;
    entries.writeUInt8(size >= 256 ? 0 : size, e);
    entries.writeUInt8(size >= 256 ? 0 : size, e + 1);
    entries.writeUInt8(0, e + 2);
    entries.writeUInt8(0, e + 3);
    entries.writeUInt16LE(1, e + 4);
    entries.writeUInt16LE(32, e + 6);
    entries.writeUInt32LE(buf.length, e + 8);
    entries.writeUInt32LE(offset, e + 12);
    offset += buf.length;
  });
  return Buffer.concat([header, entries, ...pngs.map((p) => p.buf)]);
}

const OG_TEMPLATE = (logoB64) => `<!doctype html><html><head><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:1200px; height:630px; background:${CREAM}; font-family: Inter, system-ui, sans-serif; display:flex; align-items:center; gap:64px; padding:80px; }
  .mark { width:320px; height:340px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
  .mark img { max-width:100%; max-height:100%; }
  .rule { width:6px; height:340px; background-image: linear-gradient(180deg, ${INK} 50%, transparent 50%); background-size: 100% 12px; }
  h1 { font-size:120px; letter-spacing:-0.03em; color:${INK}; font-weight:700; line-height:1; }
  p { margin-top:22px; font-size:34px; line-height:1.35; color:#3B372F; max-width:640px; }
  .tag { margin-top:30px; display:inline-block; font-size:22px; font-weight:600; letter-spacing:0.14em; text-transform:uppercase; color:${GREEN}; border:4px solid ${GREEN}; padding:10px 18px; }
</style></head><body>
  <div class="mark"><img src="data:image/png;base64,${logoB64}" alt="OUM"></div>
  <div class="rule"></div>
  <div>
    <h1>OUM</h1>
    <p>Your autonomous AI-powered YouTube channel manager. You just approve.</p>
    <span class="tag">Research · Create · Publish</span>
  </div>
</body></html>`;

async function main() {
  if (!fs.existsSync(MASTER)) {
    throw new Error(`Master logo missing: ${MASTER}`);
  }

  /* 1 · tight crop of the real logo — same alpha>8 threshold as before */
  const { data, info } = await sharp(MASTER)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let x0 = info.width;
  let y0 = info.height;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const markPng = await sharp(MASTER)
    .extract({ left: x0, top: y0, width: w, height: h })
    .png({ compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(path.join(PUB, "oum-logo.png"), markPng);
  console.log(
    `· oum-logo.png   tight crop ${w}x${h} at (${x0},${y0}) — from oum.png ${info.width}x${info.height}`
  );

  /* 2 · square canvas (edge-to-edge horizontally) for the icon set */
  const side = Math.max(w, h);
  const square = await sharp({
    create: {
      width: side,
      height: side,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: markPng,
        left: Math.round((side - w) / 2),
        top: Math.round((side - h) / 2),
      },
    ])
    .png()
    .toBuffer();

  const png = (size) =>
    sharp(square).resize(size, size, { fit: "fill" }).png({ compressionLevel: 9 });

  /* 3 · transparent raster set */
  const buf32 = await png(32).toBuffer();
  const buf192 = await png(192).toBuffer();
  const buf512 = await png(512).toBuffer();
  fs.writeFileSync(path.join(PUB, "icon-32.png"), buf32);
  fs.writeFileSync(path.join(PUB, "icon-192.png"), buf192);
  fs.writeFileSync(path.join(PUB, "icon-512.png"), buf512);

  /* 4 · apple-touch 180 — cream background (iOS ignores transparency) */
  const apple = await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: { r: 245, g: 239, b: 225, alpha: 1 },
    },
  })
    .composite([
      {
        input: await sharp(square)
          .resize(Math.round(180 * 0.78))
          .png()
          .toBuffer(),
        gravity: "centre",
      },
    ])
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(PUB, "apple-touch-icon.png"), apple);

  /* 5 · maskable 512 — robot at 80% on cream (safe zone for OS masks) */
  const maskable = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 245, g: 239, b: 225, alpha: 1 },
    },
  })
    .composite([
      {
        input: await sharp(square)
          .resize(Math.round(512 * 0.8))
          .png()
          .toBuffer(),
        gravity: "centre",
      },
    ])
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(PUB, "icon-maskable-512.png"), maskable);

  /* 6 · ICO 16/32/48 */
  const b16 = await png(16).toBuffer();
  const b48 = await png(48).toBuffer();
  fs.writeFileSync(
    path.join(PUB, "favicon.ico"),
    buildIco([
      { size: 16, buf: b16 },
      { size: 32, buf: buf32 },
      { size: 48, buf: b48 },
    ])
  );

  /* 7 · Next file-based icons */
  fs.writeFileSync(path.join(APP, "icon.png"), buf512);
  fs.writeFileSync(path.join(APP, "apple-icon.png"), apple);

  /* 8 · OG card 1200x630 — real logo + pixel rule + copy */
  const browser = await chromium.launch();
  const ogPage = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await ogPage.setContent(OG_TEMPLATE(markPng.toString("base64")), {
    waitUntil: "load",
  });
  await ogPage.waitForTimeout(200);
  await ogPage.screenshot({ path: path.join(PUB, "og.png") });
  await browser.close();

  /* 9 · remove legacy redrawn assets so only real-logo files remain */
  for (const gone of ["oum-mark.png", "icon.svg", "favicon-32.png"]) {
    const p = path.join(PUB, gone);
    if (fs.existsSync(p)) {
      fs.rmSync(p);
      console.log(`· removed legacy asset: public/${gone}`);
    }
  }

  console.log("\nicons written from the real logo (public/oum.png):");
  for (const f of [
    "oum-logo.png",
    "favicon.ico",
    "icon-32.png",
    "icon-192.png",
    "icon-512.png",
    "icon-maskable-512.png",
    "apple-touch-icon.png",
    "og.png",
  ]) {
    console.log(`  ${f.padEnd(24)} ${fs.statSync(path.join(PUB, f)).size} bytes`);
  }
  console.log("app/icon.png + app/apple-icon.png refreshed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
