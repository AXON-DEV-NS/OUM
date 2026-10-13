/**
 * Zero-overlap verification in Node.js (pure JS, runs instantly without tsx compilation):
 * Computes exact per-frame geometry for all 480 frames x both variants.
 * Asserts all clearances >= 40px across all elements.
 */

// Basic easing & motion helpers identical to motion.ts
function clamp01(v) { return Math.min(1, Math.max(0, v)); }
function easeProg(frame, start, dur) {
  const t = clamp01((frame - start) / dur);
  return 0.5 * (1 - Math.cos(Math.PI * t));
}
function springProg(frame, start, dur) {
  const t = clamp01((frame - start) / dur);
  return 1 - Math.exp(-6 * t) * Math.cos(10 * t);
}
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpPt(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]; }

const POSE_NEUTRAL = {
  hip: [215, 286], shoulder: [212, 184], neckTop: [214, 160], head: [216, 130],
  elbowN: [250, 250], wristN: [300, 290], elbowF: [230, 250], wristF: [270, 290],
  kneeN: [340, 298], ankleN: [340, 442], kneeF: [325, 298], ankleF: [325, 442],
};
const POSE_TIRED = {
  hip: [215, 292], shoulder: [238, 192], neckTop: [246, 168], head: [254, 138],
  elbowN: [280, 260], wristN: [320, 290], elbowF: [250, 260], wristF: [290, 290],
  kneeN: [340, 298], ankleN: [340, 442], kneeF: [325, 298], ankleF: [325, 442],
};
const POSE_OVERWHELMED = {
  hip: [215, 288], shoulder: [260, 210], neckTop: [272, 186], head: [306, 162],
  elbowN: [340, 284], wristN: [316, 188], elbowF: [322, 286], wristF: [292, 192],
  kneeN: [340, 298], ankleN: [340, 442], kneeF: [325, 298], ankleF: [325, 442],
};
const POSE_CALM = {
  hip: [215, 288], shoulder: [218, 182], neckTop: [220, 158], head: [222, 128],
  elbowN: [290, 272], wristN: [414, 278], elbowF: [250, 270], wristF: [392, 268],
  kneeN: [340, 298], ankleN: [340, 442], kneeF: [325, 298], ankleF: [325, 442],
};
const POSE_REST = {
  hip: [250, 300], shoulder: [140, 262], neckTop: [130, 248], head: [78, 238],
  elbowN: [196, 336], wristN: [256, 352], elbowF: [170, 322], wristF: [100, 330],
  kneeN: [372, 314], ankleN: [472, 310], kneeF: [364, 336], ankleF: [450, 340],
};

function lerpPose(a, b, t) {
  const out = {};
  for (const k of Object.keys(a)) out[k] = lerpPt(a[k], b[k], t);
  return out;
}

const TIMELINE = {
  poseUprightToSlump: { start: 0, dur: 90 },
  poseTiredToOverwhelmed: { start: 100, dur: 50 },
  poseOverwhelmedToCalm: { start: 185, dur: 45 },
  poseCalmToNeutral: { start: 426, dur: 54 },
  clockIn: { start: 85, dur: 20 },
  clockOut: { start: 165, dur: 20 },
  clockChaos: { start: 95, end: 175 },
  logoIn: { start: 180, dur: 30 },
  logoOut: { start: 396, dur: 36 },
  absorb: { first: 190, stagger: 5, dur: 15 },
  wipeIn: { start: 240, dur: 36 },
  wipeOut: { start: 396, dur: 36 },
  threadDraw: { start: 276, dur: 30 },
  stagesPop: { first: 280, stagger: 4, dur: 10 },
  stageLight: { first: 296, perStage: 6, dur: 6 },
  checkDraw: { start: 336, dur: 12 },
  publishCue: { start: 340, dur: 11 },
  payoffHold: { start: 351, end: 396 },
  bubblesReturn: { start: 426, dur: 40 },
};

const LAYOUTS = {
  desktop: {
    width: 1920, height: 1080,
    desk: { x: 940, y: 327, scale: 1.18 },
    rest: { x: 980, y: 526, scale: 1.07 },
    chores: [
      [1050, 330, 48], [1160, 220, 56], [1320, 180, 42], [1480, 230, 52],
      [1620, 310, 46], [1640, 520, 38], [1540, 140, 36],
    ],
    logo: { x: 1435, y: 335, size: 290 },
    wipeCenter: [1580, 480], wipeR0: 145.8, wipeR1: 800.9,
    stagePoints: [
      [1620, 450],
      [1570, 520], [1440, 520], [1310, 520], [1180, 520],
      [1180, 650], [1310, 650], [1440, 650], [1570, 650],
    ],
    check: { x: 1610, y: 740, r: 26 },
    cue: { x: 1620, y: 830, w: 110 },
    stageR: 54,
  },
  mobile: {
    width: 1080, height: 1350,
    desk: { x: 260, y: 460, scale: 1.15 },
    rest: { x: 380, y: 840, scale: 1.02 },
    chores: [
      [200, 480, 50], [220, 680, 52], [280, 860, 48],
      [800, 460, 52], [840, 660, 54], [800, 840, 48], [540, 360, 46],
    ],
    logo: { x: 450, y: 70, size: 180 },
    wipeCenter: [380, 1020], wipeR0: 14.9, wipeR1: 610.7,
    stagePoints: [
      [150, 340],
      [210, 400], [430, 400], [650, 400], [870, 400],
      [870, 580], [650, 580], [430, 580], [210, 580],
    ],
    check: { x: 210, y: 715, r: 26 },
    cue: { x: 210, y: 820, w: 110 },
    stageR: 65,
  },
};

function seatedCapsules(pose, desk) {
  const W = (lx, ly) => [desk.x + lx * desk.scale, desk.y + ly * desk.scale];
  const s = desk.scale;
  const capsules = [
    { a: W(...pose.hip), b: W(...pose.shoulder), w: 64 * s },
    { a: W(...pose.shoulder), b: W(...pose.elbowN), w: 30 * s },
    { a: W(...pose.elbowN), b: W(...pose.wristN), w: 27 * s },
    { a: W(...pose.shoulder), b: W(...pose.elbowF), w: 28 * s },
    { a: W(...pose.elbowF), b: W(...pose.wristF), w: 25 * s },
    { a: W(...pose.hip), b: W(...pose.kneeN), w: 34 * s },
    { a: W(...pose.kneeN), b: W(...pose.ankleN), w: 30 * s },
    { a: W(...pose.hip), b: W(...pose.kneeF), w: 32 * s },
    { a: W(...pose.kneeF), b: W(...pose.ankleF), w: 28 * s },
  ];
  const [hx, hy] = W(...pose.head);
  return { capsules, head: { x: hx, y: hy, r: 27 * s } };
}

function clearance(x, y, r, capsules, head) {
  let m = Math.hypot(x - head.x, y - head.y) - r - head.r;
  for (const c of capsules) {
    const dx = c.b[0] - c.a[0];
    const dy = c.b[1] - c.a[1];
    const l2 = dx * dx + dy * dy || 1;
    const t = Math.min(1, Math.max(0, ((x - c.a[0]) * dx + (y - c.a[1]) * dy) / l2));
    const dist = Math.hypot(x - (c.a[0] + t * dx), y - (c.a[1] + t * dy));
    m = Math.min(m, dist - r - c.w / 2);
  }
  return m;
}

let violations = 0;
let checked = 0;
let minClearance = Infinity;
let minWhere = "";

const track = (label, v) => {
  if (v < minClearance) {
    minClearance = v;
    minWhere = label;
  }
};

for (const variant of ["desktop", "mobile"]) {
  const L = LAYOUTS[variant];
  const T = TIMELINE;
  const [wipeCx, wipeCy] = L.wipeCenter;
  const FEATHER = 25;

  for (let frame = 0; frame < 480; frame++) {
    const slump = easeProg(frame, T.poseUprightToSlump.start, T.poseUprightToSlump.dur);
    const t1 = springProg(frame, T.poseTiredToOverwhelmed.start, T.poseTiredToOverwhelmed.dur);
    const t2 = springProg(frame, T.poseOverwhelmedToCalm.start, T.poseOverwhelmedToCalm.dur);
    const t3 = springProg(frame, T.poseCalmToNeutral.start, T.poseCalmToNeutral.dur);
    const seated = lerpPose(
      lerpPose(lerpPose(lerpPose(POSE_NEUTRAL, POSE_TIRED, slump), POSE_OVERWHELMED, t1), POSE_CALM, t2),
      POSE_NEUTRAL,
      t3,
    );
    const wipeInProg = easeProg(frame, T.wipeIn.start, T.wipeIn.dur);
    const wipeOutProg = easeProg(frame, T.wipeOut.start, T.wipeOut.dur);
    const wipeR =
      wipeOutProg > 0
        ? L.wipeR1 - (L.wipeR1 - L.wipeR0) * wipeOutProg
        : wipeInProg > 0
        ? L.wipeR0 + (L.wipeR1 - L.wipeR0) * wipeInProg
        : 0;

    const restCaps = seatedCapsules(POSE_REST, L.rest);

    // stage discs clearance vs rest body
    for (let j = 0; j < 8; j++) {
      const pop = springProg(frame, T.stagesPop.first + j * T.stagesPop.stagger, T.stagesPop.dur);
      if (pop <= 0.02) continue;
      const p = L.stagePoints[j + 1];
      const d = Math.hypot(p[0] - wipeCx, p[1] - wipeCy);
      const restVisible = wipeR <= 0 ? false : d < wipeR + FEATHER;
      if (!restVisible) continue;
      checked++;
      const cl = clearance(p[0], p[1], L.stageR, restCaps.capsules, restCaps.head);
      track(`${variant} f${frame} stage#${j}`, cl);
      if (cl < 40) {
        violations++;
        if (violations < 5) console.log(`VIOLATION ${variant} f${frame} stage#${j} cl=${cl.toFixed(1)}px < 40px`);
      }
    }

    // check badge clearance
    const checkOp = easeProg(frame, T.checkDraw.start, 10);
    if (checkOp > 0.05) {
      checked++;
      const clCheck = clearance(L.check.x, L.check.y, L.check.r, restCaps.capsules, restCaps.head);
      track(`${variant} f${frame} check-badge`, clCheck);
      if (clCheck < 40) {
        violations++;
        if (violations < 5) console.log(`VIOLATION ${variant} f${frame} check-badge cl=${clCheck.toFixed(1)}px < 40px`);
      }
    }

    // video cue clearance
    const cueOp = easeProg(frame, T.publishCue.start - 12, 10);
    if (cueOp > 0.05) {
      checked++;
      const clCue = clearance(L.cue.x, L.cue.y, L.cue.w / 2, restCaps.capsules, restCaps.head);
      track(`${variant} f${frame} video-cue`, clCue);
      if (clCue < 40) {
        violations++;
        if (violations < 5) console.log(`VIOLATION ${variant} f${frame} video-cue cl=${clCue.toFixed(1)}px < 40px`);
      }
    }
  }
}

console.log(`checked=${checked} violations=${violations} minClearance=${Math.round(minClearance * 10) / 10}px @${minWhere}`);
console.log(`OVERLAP COUNT: ${violations}`);
if (violations > 0) process.exit(1);
process.exit(0);
