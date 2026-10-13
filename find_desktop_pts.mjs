import fs from "fs";

const POSE_REST = {
  hip: [250, 300], shoulder: [140, 262], neckTop: [130, 248], head: [78, 238],
  elbowN: [196, 336], wristN: [256, 352], elbowF: [170, 322], wristF: [100, 330],
  kneeN: [372, 314], ankleN: [472, 310], kneeF: [364, 336], ankleF: [450, 340],
};
const rest = { x: 980, y: 526, scale: 1.07 };
const W = (lx, ly) => [rest.x + lx * rest.scale, rest.y + ly * rest.scale];
const s = rest.scale;
const capsules = [
  { a: W(...POSE_REST.hip), b: W(...POSE_REST.shoulder), w: 64 * s },
  { a: W(...POSE_REST.shoulder), b: W(...POSE_REST.elbowN), w: 30 * s },
  { a: W(...POSE_REST.elbowN), b: W(...POSE_REST.wristN), w: 27 * s },
  { a: W(...POSE_REST.shoulder), b: W(...POSE_REST.elbowF), w: 28 * s },
  { a: W(...POSE_REST.elbowF), b: W(...POSE_REST.wristF), w: 25 * s },
  { a: W(...POSE_REST.hip), b: W(...POSE_REST.kneeN), w: 34 * s },
  { a: W(...POSE_REST.kneeN), b: W(...POSE_REST.ankleN), w: 30 * s },
  { a: W(...POSE_REST.hip), b: W(...POSE_REST.kneeF), w: 32 * s },
  { a: W(...POSE_REST.kneeF), b: W(...POSE_REST.ankleF), w: 28 * s },
];
const [hx, hy] = W(...POSE_REST.head);
const head = { x: hx, y: hy, r: 27 * s };

function clearance(x, y, r) {
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

console.log("Check (1600, 750) r=26:", clearance(1600, 750, 26).toFixed(1) + "px");
console.log("Cue (1600, 840) w=110:", clearance(1600, 840, 55).toFixed(1) + "px");
