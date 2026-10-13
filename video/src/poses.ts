/**
 * Pose tables — ONE character system (Round 7B). The authoritative poses are
 * joint ANGLES in rig.ts; this module keeps the historical Joints (positions)
 * exports for the overlap checker by solving the rig at the key poses.
 * Bones are fixed — positions can never stretch.
 */
import {
  A_UPRIGHT,
  B_TIRED,
  C_HEADHAND,
  D_RELIEF,
  E_LOOKUP,
  solve,
  type SolvedRig,
} from "./rig";

export type { AnglePose } from "./rig";

export type JointName =
  | "hip"
  | "shoulder"
  | "neckTop"
  | "head"
  | "elbowN"
  | "wristN"
  | "elbowF"
  | "wristF"
  | "kneeN"
  | "ankleN"
  | "kneeF"
  | "ankleF";

export type Joints = Record<JointName, readonly [number, number]>;

const toJoints = (r: SolvedRig): Joints => ({
  hip: r.hip,
  shoulder: r.shoulder,
  neckTop: r.neckTop,
  head: r.head,
  elbowN: r.elbowN,
  wristN: r.wristN,
  elbowF: r.elbowF,
  wristF: r.wristF,
  kneeN: r.kneeN,
  ankleN: r.ankleN,
  kneeF: r.kneeF,
  ankleF: r.ankleF,
});

/** Upright typing — loop start/end (frame 0 ≡ frame 479). */
export const POSE_NEUTRAL: Joints = toJoints(solve(A_UPRIGHT));
/** Tired slump — 20° forward, head lower, hands on the thighs. */
export const POSE_TIRED: Joints = toJoints(solve(B_TIRED));
/** Head in hand — elbow on the desk, forearm vertical. */
export const POSE_OVERWHELMED: Joints = toJoints(solve(C_HEADHAND));
/** Discovery — small look-up toward the logo. */
export const POSE_CALM: Joints = toJoints(solve(E_LOOKUP));
/** Relief — leaning back, hands behind the head, feet on the desk. */
export const POSE_REST: Joints = toJoints(solve(D_RELIEF));
