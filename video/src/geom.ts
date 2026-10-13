import type { Layout } from "./brand";
import type { Joints } from "./poses";

export type Pt = readonly [number, number];
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Ring of cluster targets around the head during chaos (world units, per index). */
export const CLUSTER_RING: readonly (readonly [number, number])[] = [
  [-175, -70],
  [-70, -175],
  [70, -175],
  [175, -70],
  [185, 35],
  [105, 135],
  [-175, 60],
];

/**
 * Shared film geometry — the exact same math the film renders, imported by
 * the zero-overlap checker. If the film changes shape, the checker follows.
 */

export type Capsule = { a: Pt; b: Pt; w: number };

/** Body capsules (world coords) for a seated pose under a desk transform. */
export const seatedCapsules = (
  pose: Joints,
  desk: Layout["desk"],
): { capsules: Capsule[]; head: { x: number; y: number; r: number } } => {
  const W = (lx: number, ly: number): Pt => [desk.x + lx * desk.scale, desk.y + ly * desk.scale];
  const s = desk.scale;
  const capsules: Capsule[] = [
    { a: W(...pose.hip), b: W(...pose.shoulder), w: 72 * s },
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
};

/** Push a disc center away from every body capsule (+margin). Returns [x, y]. */
export const repelFromBody = (
  x: number,
  y: number,
  r: number,
  capsules: Capsule[],
  head: { x: number; y: number; r: number },
  margin = 40,
): Pt => {
  let px = x;
  let py = y;
  const segDist = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
  ): { d: number; nx: number; ny: number } => {
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy || 1;
    const t = clamp01(((px - ax) * dx + (py - ay) * dy) / l2);
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const d = Math.hypot(px - cx, py - cy);
    const inv = d > 0.0001 ? 1 / d : 0;
    return { d, nx: (px - cx) * inv, ny: (py - cy) * inv };
  };
  for (const c of capsules) {
    const { d, nx, ny } = segDist(c.a[0], c.a[1], c.b[0], c.b[1]);
    const need = r + margin + c.w / 2;
    if (d < need) {
      px += nx * (need - d);
      py += ny * (need - d);
    }
  }
  {
    const d = Math.hypot(px - head.x, py - head.y);
    const need = r + margin + head.r;
    if (d < need) {
      const inv = d > 0.0001 ? 1 / d : 1;
      px = head.x + (px - head.x) * inv * need;
      py = head.y + (py - head.y) * inv * need;
    }
  }
  return [px, py];
};

/** True if a disc overlaps a capsule set (for the checker). */
export const discHitsBody = (
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
    const t = clamp01(((x - c.a[0]) * dx + (y - c.a[1]) * dy) / l2);
    if (Math.hypot(x - (c.a[0] + t * dx), y - (c.a[1] + t * dy)) < r + c.w / 2) return true;
  }
  return Math.hypot(x - head.x, y - head.y) < r + head.r;
};

/** Catmull-Rom through knots → smooth cubic path (no sharp corners). */
export const smoothPath = (pts: readonly (readonly [number, number])[]) => {
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return d;
};

/** Quadratic bezier point. */
export const quad = (
  ax: number,
  ay: number,
  cx: number,
  cy: number,
  bx: number,
  by: number,
  t: number,
): Pt => {
  const u = 1 - t;
  return [u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by];
};

const lerpN = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * THE bubble position rule — used by the film AND the overlap checker so they
 * can never drift:
 *   base → (chaos) cluster ring, always repelled off the body (+40px),
 *   then a high arc into the logo; a final shove keeps every flight frame
 *   clear of the silhouette too.
 */
export const bubblePosition = (args: {
  bx: number;
  by: number;
  br: number;
  i: number;
  chaosPull: number;
  flight: number;
  headX: number;
  headY: number;
  logoCx: number;
  logoCy: number;
  capsules: Capsule[];
  head: { x: number; y: number; r: number };
}): Pt => {
  const { bx, by, br, i, chaosPull, flight, headX, headY, logoCx, logoCy, capsules, head } = args;
  const px = lerpN(bx, headX + CLUSTER_RING[i][0], chaosPull);
  const py = lerpN(by, headY + CLUSTER_RING[i][1], chaosPull);
  const [sx, sy] = repelFromBody(px, py, br, capsules, head);
  if (flight <= 0) return [sx, sy];
  if (flight >= 1) return [logoCx, logoCy];
  const [qx, qy] = quad(sx, sy, (sx + logoCx) / 2, Math.min(sy, logoCy) - 240, logoCx, logoCy, flight);
  if (flight < 0.98) return repelFromBody(qx, qy, br, capsules, head);
  return [qx, qy];
};
