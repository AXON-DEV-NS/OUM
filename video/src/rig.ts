/**
 * rig.ts — ONE character system (Round 7B): fixed bone lengths, poses are
 * joint ANGLES (degrees, 0° = +x/right, 90° = down/screen, -90° = up).
 * Forward kinematics solve() → Joints positions for rendering + checks.
 * Units: D (head diameter) = 60 local units. Values from CHARACTER-SPEC.md.
 */

export const D = 60;
export const HEAD_R = 30;
export const TORSO = 162; // 2.70 D
export const THIGH = 96; // 1.60 D
export const SHIN = 96; // 1.60 D
export const UPPER_ARM = 84; // 1.40 D
export const FOREARM = 78; // 1.30 D
export const ARM_W = 27; // 0.45 D
export const LEG_W = 36; // 0.60 D
export const HEAD_GAP = 12; // 0.20 D
export const FOOT_LEN = 30; // 0.50 D
export const FOOT_H = 12; // 0.20 D

/** Seated frame: floor y=460 → hips at 460 - SHIN - FOOT_H = 352. */
export const HIP_SEATED: readonly [number, number] = [215, 352];

export type AnglePose = {
  /** torso axis angle (from hip to shoulder) */
  torso: number;
  /** near arm */
  upperN: number;
  foreN: number;
  /** far arm */
  upperF: number;
  foreF: number;
  /** near leg */
  thighN: number;
  shinN: number;
  /** far leg */
  thighF: number;
  shinF: number;
  /** head extra offset relative to the torso direction (droop) */
  headDroop: number;
};

const rad = (deg: number) => (deg * Math.PI) / 180;
const step = (from: readonly [number, number], len: number, deg: number): readonly [number, number] => [
  from[0] + len * Math.cos(rad(deg)),
  from[1] + len * Math.sin(rad(deg)),
];

export interface SolvedRig {
  hip: readonly [number, number];
  shoulder: readonly [number, number];
  head: readonly [number, number];
  neckTop: readonly [number, number];
  elbowN: readonly [number, number];
  wristN: readonly [number, number];
  elbowF: readonly [number, number];
  wristF: readonly [number, number];
  kneeN: readonly [number, number];
  ankleN: readonly [number, number];
  kneeF: readonly [number, number];
  ankleF: readonly [number, number];
  /** torso axis used for drawing the trapezoid */
  torsoAngle: number;
}

export const solve = (p: AnglePose, hip: readonly [number, number] = HIP_SEATED): SolvedRig => {
  const shoulder = step(hip, TORSO, p.torso);
  const neckTop = step(hip, TORSO - HEAD_GAP, p.torso);
  const head = step(hip, TORSO + HEAD_R + p.headDroop, p.torso);
  const elbowN = step(shoulder, UPPER_ARM, p.upperN);
  const wristN = step(elbowN, FOREARM, p.foreN);
  const elbowF = step(shoulder, UPPER_ARM, p.upperF);
  const wristF = step(elbowF, FOREARM, p.foreF);
  const kneeN = step(hip, THIGH, p.thighN);
  const ankleN = step(kneeN, SHIN, p.shinN);
  const kneeF = step(hip, THIGH, p.thighF);
  const ankleF = step(kneeF, SHIN, p.shinF);
  return {
    hip,
    shoulder,
    head,
    neckTop,
    elbowN,
    wristN,
    elbowF,
    wristF,
    kneeN,
    ankleN,
    kneeF,
    ankleF,
    torsoAngle: p.torso,
  };
};

/** Linear interpolation of ANGLES (never positions → bones never stretch). */
export const lerpAngles = (a: AnglePose, b: AnglePose, t: number): AnglePose => {
  const out = {} as Record<keyof AnglePose, number>;
  for (const k of Object.keys(a) as (keyof AnglePose)[]) {
    out[k] = a[k] + (b[k] - a[k]) * t;
  }
  return out as AnglePose;
};

/* ---------------- The four poses (7B) + discovery lookup ----------------
 * Seated on the same chair all film long. Feet flat & shins vertical in
 * a/b/c; in d the feet rest crossed on the desk edge. */

/** a) upright typing */
export const A_UPRIGHT: AnglePose = {
  torso: -88,
  upperN: 42,
  foreN: 6,
  upperF: 60,
  foreF: 30,
  thighN: 2,
  shinN: 90,
  thighF: 8,
  shinF: 86,
  headDroop: 0,
};

/** b) tired slump — torso 20° forward vs upright, head 20px lower, hands on thighs */
export const B_TIRED: AnglePose = {
  torso: -68,
  upperN: 62,
  foreN: 70,
  upperF: 74,
  foreF: 58,
  thighN: 2,
  shinN: 90,
  thighF: 8,
  shinF: 86,
  headDroop: 6,
};

/** c) head in hand — elbow planted on the desk, forearm vertical */
export const C_HEADHAND: AnglePose = {
  torso: -75,
  upperN: 54,
  foreN: -90,
  upperF: 62,
  foreF: -84,
  thighN: 2,
  shinN: 90,
  thighF: 8,
  shinF: 86,
  headDroop: 18,
};

/** discovery — a small look-up toward the logo (head tips back) */
export const E_LOOKUP: AnglePose = {
  ...A_UPRIGHT,
  torso: -84,
  headDroop: 10,
  upperN: 46,
  foreN: 16,
};

/** d) relief — leaning back ~25°, hands behind the head, feet crossed on the desk.
 *  Arm angles are wrapped (≤ −180°) so the C→D and D→A interpolations take
 *  the natural over-the-head path, never through the desk. */
export const D_RELIEF: AnglePose = {
  torso: -115,
  upperN: -84,
  foreN: -225.3,
  upperF: -95,
  foreF: -200,
  thighN: -15,
  shinN: -40,
  thighF: -9,
  shinF: -48,
  headDroop: 0,
};
