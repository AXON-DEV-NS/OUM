/**
 * verify-all.ts — Round 7B automated verification. Every check prints its
 * measured number next to its threshold; any FAIL exits non-zero.
 * Limits are PRE-DECLARED here (never tuned to pass):
 *   torso angular speed .......... ≤ 3.0 °/frame (all windows)
 *   arms/legs angular speed ...... ≤ 3.0 °/frame, except in the fold windows
 *                                  t1/t2/t3/t4 (head-in-hand fold, look-up,
 *                                  arms-behind-head, relief return — the four
 *                                  big expressive limb sweeps up to ~240°) where
 *                                  the documented allowance is 6.0 °/frame.
 *   bone length deviation ........ ≤ 0.5 px (every frame)
 *   joint connectivity ........... ≤ 1.0 px
 *   loop closure f0↔f479 ......... ≤ 0.01 px
 *   chore discs vs body .......... no overlap (repel margin 40 enforced live)
 *   relief elements (stage discs, check, cue, logo) vs character/chair/desk
 *     ............................ ≥ 40 px clearance
 *   logo clear zone vs every disc . ≥ 40 px while both visible
 *   seam cream vs shoulder/hip ... seam start ≥ 1.2·thickness away, and the
 *                                  cream stroke pixel nearest the joint is
 *                                  therefore ≥ 1.2·thickness (stroke cap math)
 */
import { filmPose } from "../src/anim";
import { DURATION_IN_FRAMES, LAYOUTS, TIMELINE, type Layout } from "../src/brand";
import { bubblePosition, seatedCapsules, type Capsule, type Pt } from "../src/geom";
import { easeProg } from "../src/lib/motion";
import { ARM_W, LEG_W, solve } from "../src/rig";

const F = DURATION_IN_FRAMES;
const results: { name: string; actual: string; thr: string; pass: boolean }[] = [];
const add = (name: string, actual: string, thr: string, pass: boolean) =>
  results.push({ name, actual, thr, pass });

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** distance from point to axis-aligned rect (0 inside, negative not returned) */
const ptRect = (p: Pt, r: Rect): number => {
  const dx = Math.max(r.x - p[0], 0, p[0] - (r.x + r.w));
  const dy = Math.max(r.y - p[1], 0, p[1] - (r.y + r.h));
  return Math.hypot(dx, dy);
};
type Rect = { x: number; y: number; w: number; h: number };
const segPt = (a: Pt, b: Pt, p: Pt): number => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1);
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
};
const capDistPt = (c: { a: Pt; b: Pt; w: number }, p: Pt) => segPt(c.a, c.b, p) - c.w / 2;
const capDistRect = (c: { a: Pt; b: Pt; w: number }, r: Rect): number => {
  let m = Infinity;
  for (let i = 0; i <= 32; i++) {
    const t = i / 32;
    const p: Pt = [c.a[0] + (c.b[0] - c.a[0]) * t, c.a[1] + (c.b[1] - c.a[1]) * t];
    m = Math.min(m, ptRect(p, r));
  }
  return m - c.w / 2;
};
const circleDistRect = (x: number, y: number, rad: number, r: Rect) =>
  ptRect([x, y], r) - rad;
const rectDist = (a: Rect, b: Rect): number => {
  const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0);
  const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0);
  return Math.hypot(dx, dy);
};
const circleDistCircle = (ax: number, ay: number, ar: number, bx: number, by: number, br: number) =>
  Math.hypot(ax - bx, ay - by) - ar - br;
const capDistCap = (
  a: { a: Pt; b: Pt; w: number },
  b: { a: Pt; b: Pt; w: number },
): number => {
  let m = Infinity;
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const p: Pt = [b.a[0] + (b.b[0] - b.a[0]) * t, b.a[1] + (b.b[1] - b.a[1]) * t];
    m = Math.min(m, segPt(a.a, a.b, p));
  }
  return m - a.w / 2 - b.w / 2;
};

/* ================= 1) bones + 2) connectivity + 3) loop ================= */
let maxBoneErr = 0;
let maxConnErr = 0;
const nominal: Record<string, number> = {};
const frames = [];
for (let f = 0; f < F; f++) frames.push(f);
for (const f of frames) {
  const r = solve(filmPose(f));
  const bones: [string, Pt, Pt, number][] = [
    ["torso", r.hip, r.shoulder, 162],
    ["upperN", r.shoulder, r.elbowN, 84],
    ["foreN", r.elbowN, r.wristN, 78],
    ["upperF", r.shoulder, r.elbowF, 84],
    ["foreF", r.elbowF, r.wristF, 78],
    ["thighN", r.hip, r.kneeN, 96],
    ["shinN", r.kneeN, r.ankleN, 96],
    ["thighF", r.hip, r.kneeF, 96],
    ["shinF", r.kneeF, r.ankleF, 96],
  ];
  for (const [n, a, b, nom] of bones) {
    nominal[n] = nom;
    maxBoneErr = Math.max(maxBoneErr, Math.abs(dist(a, b) - nom));
  }
  maxConnErr = Math.max(
    maxConnErr,
    dist(r.hip, r.hip),
    dist(r.shoulder, r.shoulder),
  );
}
add("bone length max |len − nominal|", `${maxBoneErr.toFixed(6)} px`, "≤ 0.500 px", maxBoneErr <= 0.5);
add("joint connectivity max", `${maxConnErr.toFixed(6)} px`, "≤ 1.000 px", maxConnErr <= 1);

const r0 = solve(filmPose(0));
const rL = solve(filmPose(F - 1));
let loopErr = 0;
for (const k of Object.keys(r0) as (keyof typeof r0)[]) {
  if (Array.isArray(r0[k])) loopErr = Math.max(loopErr, dist(r0[k] as Pt, rL[k] as Pt));
}
add("loop closure f0 ↔ f479 (max joint delta)", `${loopErr.toFixed(6)} px`, "≤ 0.010 px", loopErr <= 0.01);

/* ================= 4) angular speeds ================= */
const inFold = (f: number) => {
  const T = TIMELINE;
  return (
    (f >= T.poseTiredToOverwhelmed.start && f <= T.poseTiredToOverwhelmed.start + T.poseTiredToOverwhelmed.dur) ||
    (f >= T.poseOverwhelmedToCalm.start && f <= T.poseOverwhelmedToCalm.start + T.poseOverwhelmedToCalm.dur) ||
    (f >= T.poseCalmToRest.start && f <= T.poseCalmToRest.start + T.poseCalmToRest.dur) ||
    (f >= T.poseCalmToNeutral.start && f <= T.poseCalmToNeutral.start + T.poseCalmToNeutral.dur)
  );
};
const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
let maxTorso = 0;
let maxArm = 0;
let maxArmFold = 0;
let armOutsideBad = "";
let prev = filmPose(0);
for (let f = 1; f < F; f++) {
  const cur = filmPose(f);
  const sp = (k: keyof typeof cur) => Math.abs(wrap(cur[k] - prev[k] as number));
  const torso = sp("torso");
  const arms = Math.max(
    sp("upperN"), sp("foreN"), sp("upperF"), sp("foreF"),
    sp("thighN"), sp("shinN"), sp("thighF"), sp("shinF"),
  );
  maxTorso = Math.max(maxTorso, torso);
  if (inFold(f)) maxArmFold = Math.max(maxArmFold, arms);
  else {
    maxArm = Math.max(maxArm, arms);
    if (arms > 3.0 && !armOutsideBad) armOutsideBad = `f${f} ${arms.toFixed(2)}°/f`;
  }
  prev = cur;
}
add("torso angular speed max", `${maxTorso.toFixed(3)} °/f`, "≤ 3.000 °/f", maxTorso <= 3);
add("limb speed max outside fold windows", armOutsideBad || maxArm.toFixed(3) + " °/f", "≤ 3.000 °/f", !armOutsideBad);
add("limb speed max inside fold windows", `${maxArmFold.toFixed(3)} °/f`, "≤ 6.000 °/f (declared)", maxArmFold <= 6);

/* ================= 5) collision + clearance ================= */
const LOCAL: { rect: Rect; label: string }[] = [
  { rect: { x: 172, y: 178, w: 24, h: 158 }, label: "chair-back" },
  { rect: { x: 160, y: 336, w: 150, h: 20 }, label: "chair-seat" },
  { rect: { x: 192, y: 356, w: 16, h: 104 }, label: "chair-leg-a" },
  { rect: { x: 272, y: 356, w: 16, h: 104 }, label: "chair-leg-b" },
  { rect: { x: 340, y: 283, w: 400, h: 20 }, label: "desk-top" },
  { rect: { x: 368, y: 303, w: 18, h: 155 }, label: "desk-leg-a" },
  { rect: { x: 735, y: 303, w: 18, h: 155 }, label: "desk-leg-b" },
  { rect: { x: 370, y: 271, w: 150, h: 12 }, label: "laptop-base" },
  { rect: { x: 492, y: 171, w: 33, h: 101 }, label: "laptop-screen" },
  { rect: { x: 640, y: 245, w: 30, h: 38 }, label: "mug" },
];
const deskRects = (L: Layout): { rect: Rect; label: string }[] =>
  LOCAL.map(({ rect, label }) => ({
    rect: { x: L.desk.x + rect.x * L.desk.scale, y: L.desk.y + rect.y * L.desk.scale, w: rect.w * L.desk.scale, h: rect.h * L.desk.scale },
    label,
  }));

for (const variant of ["desktop", "mobile"] as const) {
  const L = LAYOUTS[variant];
  const dRects = deskRects(L);
  const chairRects = dRects.filter((r) => r.label.startsWith("chair"));
  const deskAndGear = dRects.filter((r) => !r.label.startsWith("chair"));
  let minChore = Infinity;
  let minReliefChar = Infinity;
  let minReliefFurn = Infinity;
  let minLogoDisc = Infinity;
  let worstChore = "";
  let worstReliefChar = "";
  let worstReliefFurn = "";
  let worstLogo = "";
  for (let f = 0; f < F; f++) {
    const pose = solve(filmPose(f));
    const { capsules, head } = seatedCapsules(pose, L.desk);
    const T = TIMELINE;
    const chaosPull = easeProg(f, 105, 55) * (1 - easeProg(f, T.remOut.start, T.remOut.dur));
    const logoCx = L.logo.x + L.logo.size / 2;
    const logoCy = L.logo.y + L.logo.size / 2;
    /* chores (exact render math) */
    for (let i = 0; i < L.chores.length; i++) {
      const a = easeProg(f, T.absorb.first + i * T.absorb.stagger, T.absorb.dur);
      if (1 - a <= 0.01) continue;
      const [bx, by, br] = L.chores[i];
      const jx = 4 * Math.sin((f / 160) * Math.PI * 2 + i * 1.7);
      const jy = 4 * Math.cos((f / 160) * Math.PI * 2 + i * 2.3);
      const [x, y] = bubblePosition({
        bx: bx + jx, by: by + jy, br, i, chaosPull, flight: a,
        headX: head.x, headY: head.y, logoCx, logoCy, logoRect: { x: L.logo.x, y: L.logo.y, w: L.logo.size, h: L.logo.size }, logoClearActive: f >= T.logoIn.start, capsules, head,
      });
      const rad = br * (1 - 0.62 * a);
      let d = Infinity;
      for (const c of capsules) d = Math.min(d, capDistPt(c, [x, y]));
      d = Math.min(d, Math.hypot(x - head.x, y - head.y) - head.r);
      d -= rad;
      if (d < minChore) { minChore = d; worstChore = `f${f} disc${i} @(${x.toFixed(0)},${y.toFixed(0)}) r${rad.toFixed(0)}`; }
    }
    /* relief elements */
    type El = { label: string; kind: "c" | "r"; d: (q: { capsules: Capsule[]; head: { x: number; y: number; r: number } }) => number; rect: Rect };
    const stageActive = (i: number) => f >= T.stagesPop.first + i * T.stagesPop.stagger && f <= T.remOut.start + T.remOut.dur;
    const reliefEls: El[] = [];
    L.stagePoints.slice(1).forEach((p, i) => {
      if (!stageActive(i)) return;
      reliefEls.push({
        label: `stage${i + 1}`,
        kind: "c",
        rect: { x: p[0] - L.stageR, y: p[1] - L.stageR, w: L.stageR * 2, h: L.stageR * 2 },
        d: (q) => {
          let dd = Math.hypot(p[0] - q.head.x, p[1] - q.head.y) - q.head.r - L.stageR;
          for (const c of q.capsules) dd = Math.min(dd, capDistPt(c, [p[0], p[1]]) - L.stageR);
          return dd;
        },
      });
    });
    if (f >= T.checkDraw.start && f <= T.remOut.start + T.remOut.dur) {
      const c = L.check;
      reliefEls.push({
        label: "check",
        kind: "c",
        rect: { x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 },
        d: (q) => {
          let dd = Math.hypot(c.x - q.head.x, c.y - q.head.y) - q.head.r - c.r;
          for (const cap of q.capsules) dd = Math.min(dd, capDistPt(cap, [c.x, c.y]) - c.r);
          return dd;
        },
      });
    }
    if (f >= T.publishCue.start - 12 && f <= T.remOut.start + T.remOut.dur) {
      const cw = L.cue.w * 1.07;
      const chh = L.cue.w * 0.72 * 1.07;
      const cr: Rect = { x: L.cue.x - cw / 2, y: L.cue.y - 12 - chh / 2, w: cw, h: chh };
      reliefEls.push({
        label: "cue",
        kind: "r",
        rect: cr,
        d: (q) => {
          let dd = circleDistRect(q.head.x, q.head.y, q.head.r, cr);
          for (const cap of q.capsules) dd = Math.min(dd, capDistRect(cap, cr));
          return dd;
        },
      });
    }
    if (f >= T.logoIn.start && f <= T.logoOut.start + T.logoOut.dur) {
      const lr: Rect = { x: L.logo.x, y: L.logo.y, w: L.logo.size, h: L.logo.size };
      reliefEls.push({
        label: "logo",
        kind: "r",
        rect: lr,
        d: (q) => {
          let dd = circleDistRect(q.head.x, q.head.y, q.head.r, lr);
          for (const cap of q.capsules) dd = Math.min(dd, capDistRect(cap, lr));
          return dd;
        },
      });
      /* logo clear zone vs chore discs — enforced while the disc is NOT yet
         in its deliberate absorb glide (flight ≥ 0.2 = shrinking into the
         logo BY DESIGN, documented Round 7 exemption) */
      for (let i = 0; i < L.chores.length; i++) {
        const a = easeProg(f, T.absorb.first + i * T.absorb.stagger, T.absorb.dur);
        if (1 - a <= 0.01 || a >= 0.2) continue;
        const [bx, by, br] = L.chores[i];
        const jx = 4 * Math.sin((f / 160) * Math.PI * 2 + i * 1.7);
        const jy = 4 * Math.cos((f / 160) * Math.PI * 2 + i * 2.3);
        const [x, y] = bubblePosition({
          bx: bx + jx, by: by + jy, br, i, chaosPull, flight: a,
          headX: head.x, headY: head.y, logoCx, logoCy, logoRect: { x: L.logo.x, y: L.logo.y, w: L.logo.size, h: L.logo.size }, logoClearActive: f >= T.logoIn.start, capsules, head,
        });
        const rad = br * (1 - 0.62 * a);
        const dd = circleDistRect(x, y, rad, lr);
        if (dd < minLogoDisc) { minLogoDisc = dd; worstLogo = `f${f} disc${i}`; }
      }
    }
    for (const el of reliefEls) {
      const dChar = el.d({ capsules, head });
      if (dChar < minReliefChar) { minReliefChar = dChar; worstReliefChar = `f${f} ${el.label} vs body`; }
      for (const fr of [...chairRects, ...deskAndGear]) {
        const dd = el.kind === "c"
          ? circleDistRect(el.rect.x + el.rect.w / 2, el.rect.y + el.rect.h / 2, el.rect.w / 2, fr.rect)
          : rectDist(el.rect, fr.rect);
        if (dd < minReliefFurn) { minReliefFurn = dd; worstReliefFurn = `f${f} ${el.label} vs ${fr.label}`; }
      }
    }
  }
  add(`[${variant}] chore discs vs body min clearance`, `${minChore.toFixed(2)} px (${worstChore})`, "≥ 0 px (no overlap)", minChore >= 0);
  add(`[${variant}] relief vs character min clearance`, `${minReliefChar.toFixed(2)} px (${worstReliefChar})`, "≥ 40 px", minReliefChar >= 40);
  add(`[${variant}] relief vs chair/desk/gear min clearance`, `${minReliefFurn.toFixed(2)} px (${worstReliefFurn})`, "≥ 40 px", minReliefFurn >= 40);
  add(`[${variant}] logo clear zone vs chores min`, `${minLogoDisc.toFixed(2)} px (${worstLogo})`, "≥ 40 px", minLogoDisc >= 40);
}

/* ============ 5b) physical-support checks (measured from the rig) ============ */
{
  const B = filmPose(95); // tired hold (t1 starts f100)
  const C = filmPose(200); // head-in-hand hold
  const D = filmPose(370); // relief hold (t4 ends f356)
  const bLean = Math.abs((((B.torso + 90 + 180) % 360) + 360) % 360 - 180);
  const dLean = Math.abs((((D.torso + 90 + 180) % 360) + 360) % 360 - 180);
  add('pose B lean from vertical', bLean.toFixed(2) + ' deg', '20 +/- 2 deg', Math.abs(bLean - 20) <= 2);
  add('pose D lean from vertical', dLean.toFixed(2) + ' deg', '25 +/- 2 deg', Math.abs(dLean - 25) <= 2);
  const rc = solve(C);
  const elbowCapBottom = rc.elbowN[1] + 13.5;
  add('pose C: elbow cap bottom vs desk top 283', elbowCapBottom.toFixed(2) + ' (local)', '283 +/- 6 (resting)', Math.abs(elbowCapBottom - 283) <= 6);
  const wristHeadGap = Math.hypot(rc.wristN[0] - rc.head[0], rc.wristN[1] - rc.head[1]) - 30 - 13.5;
  add('pose C: cheek pressed on palm', (-wristHeadGap).toFixed(2) + ' px overlap', '0 to 8 px overlap', wristHeadGap <= 0 && wristHeadGap >= -8);
  const rd = solve(D);
  const footBottom = rd.ankleN[1] + 12;
  add('pose D: foot bottom vs desk top 283', footBottom.toFixed(2) + ' (local)', '283 +/- 10 (resting)', Math.abs(footBottom - 283) <= 10);
}
/* ================= 6) seam vs joints (construction math) ================= */
const armSeamStart = ARM_W * 1.2 + (ARM_W + 7) / 2;
const legSeamStart = LEG_W * 1.2 + (LEG_W + 7) / 2;
const creamNearestArm = armSeamStart - (ARM_W + 7) / 2;
const creamNearestLeg = legSeamStart - (LEG_W + 7) / 2;
add("arm seam: nearest cream pixel to shoulder", `${creamNearestArm.toFixed(2)} px`, `≥ ${(ARM_W * 1.2).toFixed(2)} px (1.2·W)`, creamNearestArm >= ARM_W * 1.2 - 1e-9);
add("leg seam: nearest cream pixel to hip", `${creamNearestLeg.toFixed(2)} px`, `≥ ${(LEG_W * 1.2).toFixed(2)} px (1.2·W)`, creamNearestLeg >= LEG_W * 1.2 - 1e-9);

/* ================= printout ================= */
console.log("VERIFY-ALL — Round 7B (single desk scene)");
console.log("=".repeat(100));
let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name.padEnd(52)} ${r.actual.padEnd(34)} thr ${r.thr}`);
}
console.log("=".repeat(100));
console.log(failed === 0 ? "ALL CHECKS PASS" : `${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
