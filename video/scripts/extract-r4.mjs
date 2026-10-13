/**
 * Extract every proof frame needed for ROUND 4 from the draft4 renders.
 * Output-seek (-ss after -i) = exact frame decoding.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const VIDEO = "C:/Users/Maka/OneDrive/سطح المكتب/vo/vovo-agent-ai/video";
const OUT = path.join(VIDEO, "out");
const FF = path.join(VIDEO, "node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe");
const SRC = path.join(OUT, "draft4");
const R4 = path.join(OUT, "r4");
fs.mkdirSync(R4, { recursive: true });

const run = (args) => {
  const r = spawnSync(FF, args, { stdio: "pipe" });
  if (r.status !== 0) console.log("FFAIL", args.slice(4, 6).join(" "), String(r.stderr).slice(-160));
};

const grab = (src, t, name) =>
  run(["-y", "-loglevel", "error", "-i", src, "-ss", String(t), "-frames:v", "1", path.join(R4, name)]);

const d = path.join(SRC, "hero-desktop.webm");
const dm = path.join(SRC, "hero-mobile.mp4");

// ---- story frames (desktop) ----
const storyF = [0, 15, 45, 75, 105, 140, 165, 195, 225, 255, 285, 300, 318, 330, 360, 381, 395, 420, 440, 460, 479];
for (const f of storyF) grab(d, (f + 0.008) / 30, `d-${String(f).padStart(3, "0")}.png`);

// ---- poses (desktop + mobile) ----
const poses = [[50, "tired"], [140, "overwhelmed"], [240, "calm"], [350, "rest"]];
for (const [f, n] of poses) {
  grab(d, (f + 0.008) / 30, `pose-${n}.png`);
  grab(dm, (f + 0.008) / 30, `mpose-${n}.png`);
}

// ---- transition in-wipe: every frame 285..318 ----
for (let f = 285; f <= 318; f++) grab(d, (f + 0.008) / 30, `in-${String(f).padStart(3, "0")}.png`);
// ---- transition out-wipe: every 2nd frame 405..451 ----
for (let f = 405; f <= 451; f += 2) grab(d, (f + 0.008) / 30, `out-${String(f).padStart(3, "0")}.png`);

// ---- banding crops (J): glow + bloom at f360, contrast×3, 200% ----
run([
  "-y", "-loglevel", "error", "-i", d, "-ss", String((360 + 0.008) / 30), "-frames:v", "1",
  "-vf", "crop=420:320:1310:430,eq=contrast=3,scale=840:640", path.join(R4, "banding-glow.png"),
]);
run([
  "-y", "-loglevel", "error", "-i", d, "-ss", String((360 + 0.008) / 30), "-frames:v", "1",
  "-vf", "crop=560:440:1200:100,eq=contrast=3,scale=1120:880", path.join(R4, "banding-bloom.png"),
]);

console.log("EXTRACT DONE");
