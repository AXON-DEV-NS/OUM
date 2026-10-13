import React from "react";
import { COLORS } from "../brand";
import type { Joints } from "../poses";

export type { JointName, Joints } from "../poses";

/**
 * ROUND 5 figure — rebuilt from the professional pictogram reference sheets
 * the client supplied (solid black pictogram pose + walk/run-cycle sheets):
 *   · head: a clean separate circle, paper-gap ring against the torso
 *   · torso: a solid rounded trapezoid (shoulder → hip), not a stick capsule
 *   · limbs: thick rounded tubes with visible elbows/knees
 *   · hands: distinct ball hands (circles)
 *   · feet: real foot tabs pointing forward, flat on the floor line
 *   · far side in the lighter theme-green tone
 * No black, no beak torso, no floating fragments.
 * Local frame: seated floor y=460 · lying floor y=420 · faces +x.
 */

const GAP = 3.5;
const FLOOR = 460;

/** Torso path: rounded trapezoid between shoulder line and hip line. */
const Torso: React.FC<{
  shoulder: readonly [number, number];
  hip: readonly [number, number];
}> = ({ shoulder, hip }) => {
  const [sx, sy] = shoulder;
  const [hx, hy] = hip;
  const sw = 38; // half width at shoulders
  const hw = 31; // half width at hips
  const r = 18;
  const d = `
    M ${sx - sw + r} ${sy}
    L ${sx + sw - r} ${sy}
    Q ${sx + sw} ${sy} ${sx + sw} ${sy + r}
    L ${hx + hw} ${hy - r}
    Q ${hx + hw} ${hy} ${hx + hw - r} ${hy}
    L ${hx - hw + r} ${hy}
    Q ${hx - hw} ${hy} ${hx - hw} ${hy - r}
    L ${sx - sw} ${sy + r}
    Q ${sx - sw} ${sy} ${sx - sw + r} ${sy}
    Z`;
  return (
    <g>
      <path d={d} fill={COLORS.paper} stroke={COLORS.paper} strokeWidth={GAP * 2} strokeLinejoin="round" />
      <path d={d} fill={COLORS.figNear} />
    </g>
  );
};

const Limb: React.FC<{
  a: readonly [number, number];
  b: readonly [number, number];
  w: number;
  tone: string;
  gap?: boolean;
}> = ({ a, b, w, tone, gap }) => (
  <g>
    {gap ? (
      <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={COLORS.paper} strokeWidth={w + GAP * 2} strokeLinecap="round" />
    ) : null}
    <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={tone} strokeWidth={w} strokeLinecap="round" />
  </g>
);

const Hand: React.FC<{ at: readonly [number, number]; r: number; tone: string; gap?: boolean }> = ({
  at,
  r,
  tone,
  gap,
}) => (
  <g>
    {gap ? <circle cx={at[0]} cy={at[1]} r={r + GAP} fill={COLORS.paper} /> : null}
    <circle cx={at[0]} cy={at[1]} r={r} fill={tone} />
  </g>
);

const Foot: React.FC<{ at: readonly [number, number]; tone: string; gap?: boolean; floor?: number }> = ({
  at,
  tone,
  gap,
  floor = FLOOR,
}) => (
  <g>
    {gap ? (
      <rect x={at[0] - 3} y={floor - 14} width={34} height={15} rx={7} fill={COLORS.paper} />
    ) : null}
    <rect x={at[0] - 1} y={floor - 12} width={30} height={11} rx={5.5} fill={tone} />
  </g>
);

export const Person: React.FC<{ pose: Joints; breathe: number; headBob: number; floor?: number }> = ({
  pose,
  breathe,
  headBob,
  floor = FLOOR,
}) => {
  const footY = floor - 12;
  return (
    <g
      style={{
        transform: `scaleY(${breathe})`,
        transformOrigin: `${pose.hip[0]}px ${pose.hip[1]}px`,
      }}
    >
      {/* far side (light tone, behind) */}
      <Limb a={pose.hip} b={pose.kneeF} w={31} tone={COLORS.figFar} />
      <Limb a={pose.kneeF} b={pose.ankleF} w={27} tone={COLORS.figFar} />
      <Foot at={pose.ankleF} tone={COLORS.figFar} floor={floor} />
      <Limb a={pose.shoulder} b={pose.elbowF} w={27} tone={COLORS.figFar} />
      <Limb a={pose.elbowF} b={pose.wristF} w={24} tone={COLORS.figFar} />
      <Hand at={pose.wristF} r={10} tone={COLORS.figFar} />
      {/* torso */}
      <Torso shoulder={pose.shoulder} hip={pose.hip} />
      {/* near leg */}
      <Limb a={pose.hip} b={pose.kneeN} w={34} tone={COLORS.figNear} gap />
      <Limb a={pose.kneeN} b={pose.ankleN} w={30} tone={COLORS.figNear} gap />
      <Foot at={pose.ankleN} tone={COLORS.figNear} gap floor={floor} />
      {/* head (bobbed) */}
      <g transform={`translate(0 ${headBob})`}>
        <circle cx={pose.head[0]} cy={pose.head[1]} r={27 + GAP} fill={COLORS.paper} />
        <circle cx={pose.head[0]} cy={pose.head[1]} r={27} fill={COLORS.figNear} />
      </g>
      {/* near arm (on top) */}
      <Limb a={pose.shoulder} b={pose.elbowN} w={30} tone={COLORS.figNear} gap />
      <Limb a={pose.elbowN} b={pose.wristN} w={27} tone={COLORS.figNear} gap />
      <Hand at={pose.wristN} r={11} tone={COLORS.figNear} gap />
    </g>
  );
};
