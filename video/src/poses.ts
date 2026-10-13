/**
 * Pose joint tables — pure data, no React. Shared by the film (Person.tsx)
 * and the zero-overlap verification script, so the checker can never drift
 * from what is actually rendered.
 */

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

/** Upright neutral — the loop start/end state (frame 0 ≡ frame 479). */
export const POSE_NEUTRAL: Joints = {
  hip: [215, 286],
  shoulder: [212, 184],
  neckTop: [214, 160],
  head: [216, 130],
  elbowN: [250, 250],
  wristN: [300, 290],
  elbowF: [230, 250],
  wristF: [270, 290],
  kneeN: [340, 298],
  ankleN: [340, 442],
  kneeF: [325, 298],
  ankleF: [325, 442],
};

/** TIRED — slumped and heavy: hips sunk, torso leaned, head dropped, hands in lap. */
export const POSE_TIRED: Joints = {
  hip: [215, 292],
  shoulder: [238, 192],
  neckTop: [246, 168],
  head: [254, 138],
  elbowN: [280, 260],
  wristN: [320, 290],
  elbowF: [250, 260],
  wristF: [290, 290],
  kneeN: [340, 298],
  ankleN: [340, 442],
  kneeF: [325, 298],
  ankleF: [325, 442],
};

/** OVERWHELMED — head in hand: elbow planted on the desk, forearm near-vertical,
 *  palm under the chin, head tilted into it. Torso leans forward. */
export const POSE_OVERWHELMED: Joints = {
  hip: [215, 288],
  shoulder: [260, 210],
  neckTop: [272, 186],
  head: [306, 162],
  elbowN: [340, 284],
  wristN: [316, 188],
  elbowF: [322, 286],
  wristF: [292, 192],
  kneeN: [340, 298],
  ankleN: [340, 442],
  kneeF: [325, 298],
  ankleF: [325, 442],
};

/** CALM — upright, shoulders open, hands on the keyboard at elbow height. */
export const POSE_CALM: Joints = {
  hip: [215, 288],
  shoulder: [218, 182],
  neckTop: [220, 158],
  head: [222, 128],
  elbowN: [290, 272],
  wristN: [414, 278],
  elbowF: [250, 270],
  wristF: [392, 268],
  kneeN: [340, 298],
  ankleN: [340, 442],
  kneeF: [325, 298],
  ankleF: [325, 442],
};

/** Lying on the sofa (local floor y=420). */
export const POSE_REST: Joints = {
  hip: [250, 300],
  shoulder: [140, 262],
  neckTop: [130, 248],
  head: [78, 238],
  elbowN: [196, 336],
  wristN: [256, 352],
  elbowF: [170, 322],
  wristF: [100, 330],
  kneeN: [372, 314],
  ankleN: [472, 310],
  kneeF: [364, 336],
  ankleF: [456, 330],
};
