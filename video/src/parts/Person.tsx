import React from "react";
import { COLORS } from "../brand";
import type { Joints } from "../poses";
import {
  ARM_W,
  FOOT_H,
  FOOT_LEN,
  HEAD_GAP,
  HEAD_R,
  LEG_W,
} from "../rig";

export type { JointName, Joints } from "../poses";

/**
 * ROUND 7B — ONE unified pictogram silhouette (per the reference sheets):
 *   · ONE fill colour for the whole figure (far limbs same colour)
 *   · each limb is ONE continuous path (round caps + joins)
 *   · hands = the forearm's rounded cap; feet = small forward shapes fused to
 *     the shin ends
 *   · head = separate circle with exactly a 0.20 D cream gap
 *   · cream separation lines ONLY where the near arm / near leg crosses the
 *     torso or the far limb, and they start ONE limb thickness away from the
 *     shoulder / hip joint — never a cream ring at a joint
 * No outlines anywhere.
 */

const ARM_SEAM = ARM_W * 1.2 + (ARM_W + 7) / 2;
const LEG_SEAM = LEG_W * 1.2 + (LEG_W + 7) / 2;

const FOOT_AT: React.FC<{
  at: readonly [number, number];
  knee: readonly [number, number];
}> = ({ at: ankle, knee }) => {
  const raw = (Math.atan2(ankle[1] - knee[1], ankle[0] - knee[0]) * 180) / Math.PI - 90;
  const ang = Math.max(-15, Math.min(15, raw));
  return (
    <g transform={`translate(${ankle[0]} ${ankle[1]}) rotate(${ang})`}>
      <rect x={-6} y={-4} width={FOOT_LEN} height={FOOT_H} rx={FOOT_H / 2} fill={COLORS.figNear} />
    </g>
  );
};

const LIMB = (
  pts: readonly (readonly [number, number])[],
  w: number,
  color: string,
  seamStart: number | null,
) => {
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
  // seam: cream under-stroke trimmed `seamStart` px along the first segment
  let seamD = "";
  if (seamStart !== null) {
    const [a, b] = [pts[0], pts[1]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const t = Math.min(0.95, seamStart / len);
    const start: readonly [number, number] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    seamD = [`M ${start[0]} ${start[1]}`, ...pts.slice(1).map((p) => `L ${p[0]} ${p[1]}`)].join(" ");
  }
  return (
    <g>
      {seamD ? (
        <path d={seamD} fill="none" stroke={COLORS.paper} strokeWidth={w + 7} strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
      <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
};

/** Rounded polygon path (kills the sharp shoulder spike). */
const roundedPoly = (pts: readonly (readonly [number, number])[], r: number): string => {
  const n = pts.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    const v1 = [cur[0] - prev[0], cur[1] - prev[1]];
    const v2 = [next[0] - cur[0], next[1] - cur[1]];
    const l1 = Math.hypot(v1[0], v1[1]) || 1;
    const l2 = Math.hypot(v2[0], v2[1]) || 1;
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const p1 = [cur[0] - (v1[0] / l1) * rr, cur[1] - (v1[1] / l1) * rr];
    const p2 = [cur[0] + (v2[0] / l2) * rr, cur[1] + (v2[1] / l2) * rr];
    if (i === 0) d += `M ${p1[0]} ${p1[1]}`;
    else d += ` L ${p1[0]} ${p1[1]}`;
    d += ` Q ${cur[0]} ${cur[1]} ${p2[0]} ${p2[1]}`;
  }
  return d + " Z";
};

/** Torso trapezoid oriented along the hip→shoulder axis. */
const Torso: React.FC<{
  hip: readonly [number, number];
  shoulder: readonly [number, number];
}> = ({ hip, shoulder }) => {
  const dx = shoulder[0] - hip[0];
  const dy = shoulder[1] - hip[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy; // perpendicular
  const py = ux;
  const sHW = 60; // 1.0 D half-shoulder
  const hHW = 42; // 0.7 D half-hip
  const P = (
    p: readonly [number, number],
    hw: number,
    s: number,
  ): readonly [number, number] => [p[0] + px * hw * s, p[1] + py * hw * s];
  const a = P(shoulder, sHW, 1);
  const b = P(shoulder, sHW, -1);
  const c = P(hip, hHW, -1);
  const d2 = P(hip, hHW, 1);
  return <path d={roundedPoly([a, b, c, d2], 14)} fill={COLORS.figNear} stroke="none" />;
};

export const Person: React.FC<{ pose: Joints; breathe: number; headBob: number; floor?: number }> = ({
  pose,
  breathe,
  headBob,
}) => {
  const far = COLORS.figNear; // unified silhouette — same colour both sides
  return (
    <g
      style={{
        transform: `scaleY(${breathe})`,
        transformOrigin: `${pose.hip[0]}px ${pose.hip[1]}px`,
      }}
    >
      {/* far limbs (same colour, behind, no seams) */}
      {LIMB([pose.hip, pose.kneeF, pose.ankleF], LEG_W - 4, far, null)}
      <FOOT_AT at={pose.ankleF} knee={pose.kneeF} />
      {/* torso */}
      <Torso hip={pose.hip} shoulder={pose.shoulder} />
      {LIMB([pose.shoulder, pose.elbowF, pose.wristF], ARM_W - 3, far, null)}
      {/* near limbs with trimmed cream seams at the crossings only */}
      {LIMB([pose.hip, pose.kneeN, pose.ankleN], LEG_W, COLORS.figNear, LEG_SEAM)}
      <FOOT_AT at={pose.ankleN} knee={pose.kneeN} />
      {LIMB([pose.shoulder, pose.elbowN, pose.wristN], ARM_W, COLORS.figNear, ARM_SEAM)}
      {/* head — drawn AFTER the arms so wrapped-behind forearms pass behind it;
          the 0.20 D cream ring keeps the gap where anything crosses */}
      <g transform={`translate(0 ${headBob})`}>
        <circle cx={pose.head[0]} cy={pose.head[1]} r={HEAD_R + HEAD_GAP / 2} fill={COLORS.paper} />
        <circle cx={pose.head[0]} cy={pose.head[1]} r={HEAD_R} fill={COLORS.figNear} />
      </g>
    </g>
  );
};
