/**
 * Zero-overlap verification: recomputes the EXACT per-frame geometry the film
 * renders (same poses, same repel, same flight arcs, same masks) for all
 * 480 frames × both variants, and asserts no visible icon disc ever touches
 * a visible body capsule. Exit 0 + "OVERLAP COUNT: 0" on success.
 */
import { Easing, interpolate, spring } from "remotion";
import { LAYOUTS, TIMELINE, type Layout } from "../src/brand";
import {
  POSE_CALM,
  POSE_NEUTRAL,
  POSE_OVERWHELMED,
  POSE_REST,
  POSE_TIRED,
  type Joints,
} from "../src/poses";
import {
  bubblePosition,
  CLUSTER_RING,
  quad,
  repelFromBody,
  seatedCapsules,
  type Capsule,
} from "../src/geom";

const FPS = 30;
const easePremium = Easing.bezier(0.32, 0.72, 0, 1);
const easeProg = (frame: number, start: number, dur: number) =>
  interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: easePremium,
  });
const springProg = (frame: number, start: number, dur: number) =>
  spring({
    frame: Math.max(0, frame - start),
    fps: FPS,
    config: { damping: 26, stiffness: 110, mass: 1.1 },
    durationInFrames: dur,
  });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpPt = (a: readonly [number, number], b: readonly [number, number], t: number) =>
  [lerp(a[0], b[0], t), lerp(a[1], b[1], t)] as const;
const lerpPose = (a: Joints, b: Joints, t: number): Joints => {
  const out: Record<string, readonly [number, number]> = {};
  for (const k of Object.keys(a) as (keyof Joints)[]) out[k] = lerpPt(a[k], b[k], t);
  return out as Joints;
};
const periodic = (frame: number, p: number) => Math.sin((frame / p) * Math.PI * 2);

const hits = (
  x: number,
  y: number,
  r: number,
  capsules: Capsule[],
  head: { x: number; y: number; r: number },
): boolean => {
  for (const c of capsules) {
    const dx = c.b[0] - c.a[0];
    const dy = c.b[1] - c.a[1];
    const l2 = dx * dx + dy * dy || 1;
    const t = Math.min(1, Math.max(0, ((x - c.a[0]) * dx + (y - c.a[1]) * dy) / l2));
    if (Math.hypot(x - (c.a[0] + t * dx), y - (c.a[1] + t * dy)) < r + c.w / 2) return true;
  }
  return Math.hypot(x - head.x, y - head.y) < r + head.r;
};

const clearance = (
  x: number,
  y: number,
  r: number,
  capsules: Capsule[],
  head: { x: number; y: number; r: number },
): number => {
  let m = Math.hypot(x - head.x, y - head.y) - r - head.r;
  for (const c of capsules) {
    const dx = c.b[0] - c.a[0];
    const dy = c.b[1] - c.a[1];
    const l2 = dx * dx + dy * dy || 1;
    const t = Math.min(1, Math.max(0, ((x - c.a[0]) * dx + (y - c.a[1]) * dy) / l2));
    m = Math.min(m, Math.hypot(x - (c.a[0] + t * dx), y - (c.a[1] + t * dy)) - r - c.w / 2);
  }
  return m;
};

let violations = 0;
let checked = 0;
let minClearance = Infinity;
let minWhere = "";

const track = (label: string, v: number) => {
  if (v < minClearance) {
    minClearance = v;
    minWhere = label;
  }
};

for (const variant of ["desktop", "mobile"] as const) {
  const L: Layout = LAYOUTS[variant];
  const T = TIMELINE;
  const W = L.width;
  const H = L.height;
  const [wipeCx, wipeCy] = L.wipeCenter;
  const logoCx = L.logo.x + L.logo.size / 2;
  const logoCy = L.logo.y + L.logo.size / 2;
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

    const headX = L.desk.x + seated.head[0] * L.desk.scale;
    const headY = L.desk.y + seated.head[1] * L.desk.scale;
    const chaosPull = easeProg(frame, 105, 55) * (1 - easeProg(frame, 426, 40));
    const returnProg = easeProg(frame, T.bubblesReturn.start, T.bubblesReturn.dur);
    const { capsules: deskCaps, head: deskHead } = seatedCapsules(seated, L.desk);
    const restCaps = seatedCapsules(POSE_REST, L.rest);

    // stage discs (rest layer) at stagePoints[1..8]
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
        if (violations < 12) console.log(`VIOLATION ${variant} f${frame} stage#${j} clearance=${cl.toFixed(1)}px < 40px @${p.map(Math.round)}`);
      }
    }

    // check badge & video cue clearance vs rest body
    const checkOp = easeProg(frame, T.checkDraw.start, 10);
    if (checkOp > 0.05) {
      checked++;
      const clCheck = clearance(L.check.x, L.check.y, L.check.r, restCaps.capsules, restCaps.head);
      track(`${variant} f${frame} check-badge`, clCheck);
      if (clCheck < 40) {
        violations++;
        if (violations < 12) console.log(`VIOLATION ${variant} f${frame} check-badge clearance=${clCheck.toFixed(1)}px < 40px`);
      }
    }

    const cueOp = easeProg(frame, T.publishCue.start - 12, 10);
    if (cueOp > 0.05) {
      checked++;
      const clCue = clearance(L.cue.x, L.cue.y, L.cue.w / 2, restCaps.capsules, restCaps.head);
      track(`${variant} f${frame} video-cue`, clCue);
      if (clCue < 40) {
        violations++;
        if (violations < 12) console.log(`VIOLATION ${variant} f${frame} video-cue clearance=${clCue.toFixed(1)}px < 40px`);
      }
    }

    // chore discs (same rule as the film: bubblePosition)
    for (let i = 0; i < 7; i++) {
      const a = easeProg(frame, T.absorb.first + i * T.absorb.stagger, T.absorb.dur);
      const flight = a * (1 - returnProg);
      const opacity = Math.max(1 - a, returnProg);
      if (opacity <= 0.02) continue;
      const [bx, by, br] = L.chores[i];
      const jx = 4 * Math.sin((frame / 160) * Math.PI * 2 + i * 1.7);
      const jy = 4 * Math.cos((frame / 160) * Math.PI * 2 + i * 2.3);
      const [x, y] = bubblePosition({
        bx: bx + jx,
        by: by + jy,
        br,
        i,
        chaosPull,
        flight,
        headX,
        headY,
        logoCx,
        logoCy,
        capsules: deskCaps,
        head: deskHead,
      });
      checked++;
      const dDesk = Math.hypot(x - wipeCx, y - wipeCy);
      const deskVisible = wipeR <= 0 ? true : dDesk > wipeR - FEATHER;
      const restVisible = wipeR > 0 && dDesk < wipeR + FEATHER;
      if (deskVisible) {
        const clD = clearance(x, y, br, deskCaps, deskHead);
        track(`${variant} f${frame} chore#${i}-vs-desk`, clD);
        if (clD < 40) {
          violations++;
          if (violations < 12) console.log(`VIOLATION ${variant} f${frame} chore#${i} cl=${clD.toFixed(1)}px @${[Math.round(x), Math.round(y)]}`);
        }
      }
      if (restVisible) {
        const clR = clearance(x, y, br, restCaps.capsules, restCaps.head);
        track(`${variant} f${frame} chore#${i}-vs-rest`, clR);
        if (clR < 40) {
          violations++;
          if (violations < 12) console.log(`VIOLATION ${variant} f${frame} chore#${i}-vs-rest cl=${clR.toFixed(1)}px @${[Math.round(x), Math.round(y)]}`);
        }
      }
    }
  }
}

console.log(`checked=${checked} violations=${violations} minClearance=${Math.round(minClearance * 10) / 10}px @${minWhere}`);
console.log(`OVERLAP COUNT: ${violations}`);
if (violations > 0) process.exit(1);
