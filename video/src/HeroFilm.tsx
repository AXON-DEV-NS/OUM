import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, LAYOUTS, TIMELINE, type Layout } from "./brand";
import { bump, easeProg, lerp, lerpPose, periodic, springProg } from "./lib/motion";
import { type Joints } from "./poses";
import { Person } from "./parts/Person";
import { Clock, DeskFurniture } from "./parts/Furniture";
import {
  CheckBadge,
  ChoreIcon,
  Disc,
  StageIcon,
  VideoCue,
  type ChoreKind,
  type StageKind,
} from "./parts/icons";
import { LogoCard } from "./parts/LogoCard";
import { solve } from "./rig";
import { filmPose } from "./anim";
import { bubblePosition, seatedCapsules, smoothPath } from "./geom";

export type HeroVariant = "desktop" | "mobile";

const CHORES: readonly ChoreKind[] = [
  "images",
  "video",
  "voice",
  "edit",
  "publish",
  "calendar",
  "money",
];

const STAGES: readonly StageKind[] = [
  "connect",
  "research",
  "script",
  "video",
  "voice",
  "edit",
  "publish",
  "optimize",
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Total length of the smoothed stage path (knots + tail to the check). */
const stagePath = (L: Layout) => {
  const pts: readonly (readonly [number, number])[] = [
    ...L.stagePoints,
    [L.check.x, L.check.y] as const,
  ];
  const d = smoothPath(pts);
  // numeric length by sampling each cubic segment
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    let px = p1[0];
    let py = p1[1];
    for (let k = 1; k <= 12; k++) {
      const t = k / 12;
      const u = 1 - t;
      const x = u * u * u * p1[0] + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * p2[0];
      const y = u * u * u * p1[1] + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * p2[1];
      len += Math.hypot(x - px, y - py);
      px = x;
      py = y;
    }
  }
  return { d, len };
};

export const HeroFilm: React.FC<{ variant: HeroVariant }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const L = LAYOUTS[variant];
  const T = TIMELINE;
  const W = L.width;
  const H = L.height;

  // ---------- pose: shared per-frame timeline (single source: anim.ts) ----------
  const seated: Joints = solve(filmPose(frame));
  // slow breathing (stronger while tired) + drooping head
  const tiredness = 1 - easeProg(frame, T.poseCalmToRest.start, T.poseCalmToRest.dur);
  const breath = 1 + (0.014 + 0.008 * tiredness) * periodic(frame, 160);
  const headBob = 4 * periodic(frame, 160) * (0.4 + 0.6 * tiredness);
  const glow = 0.3 + 0.15 * (1 - tiredness);

  // ---------- logo ----------
  const logoIn = springProg(frame, T.logoIn.start, T.logoIn.dur, fps);
  const logoOut = easeProg(frame, T.logoOut.start, T.logoOut.dur);
  const logoOp = easeProg(frame, T.logoIn.start, T.logoIn.dur) * (1 - logoOut);
  const logoBreathe = 1 + 0.015 * periodic(frame, 240);
  const logoScale = (0.82 + 0.18 * logoIn) * logoBreathe;
  const bloom = 0.45 + 0.35 * (0.5 + 0.5 * periodic(frame, 240));

  // ---------- clock ----------
  const clockOp =
    easeProg(frame, T.clockIn.start, T.clockIn.dur) *
    (1 - easeProg(frame, T.clockOut.start, T.clockOut.dur));
  const chaosBump = bump(
    frame,
    T.clockChaos.start,
    T.clockChaos.start + 26,
    T.clockChaos.end - 26,
    T.clockChaos.end,
  );
  const wobble = Math.sin((frame / 40) * Math.PI * 2);
  const minuteAngle = (frame / 480) * 360 * 2 + chaosBump * 46 * wobble;
  const hourAngle = (frame / 480) * 360 * 0.62 + chaosBump * 14 * wobble;

  // ---------- stage path ----------
  const { d: stageD, len: stageLen } = stagePath(L);
  const threadProg = easeProg(frame, T.threadDraw.start, T.threadDraw.dur);
  const stagePop = (i: number) =>
    springProg(frame, T.stagesPop.first + i * T.stagesPop.stagger, T.stagesPop.dur, fps);
  const stageOn = (i: number) =>
    easeProg(frame, T.stageLight.first + i * T.stageLight.perStage, T.stageLight.dur);

  // ---------- check + publish cue ----------
  const checkDraw = easeProg(frame, T.checkDraw.start, T.checkDraw.dur);
  const checkScale = 0.5 + 0.5 * easeProg(frame, T.checkDraw.start, 8);
  const checkOp = easeProg(frame, T.checkDraw.start, 10);
  const cueProg = easeProg(frame, T.publishCue.start, T.publishCue.dur);
  const cueOp = easeProg(frame, T.publishCue.start - 12, 10);
  /** elements soft-out during the return so the loop closes cleanly */
  const retOut = 1 - easeProg(frame, T.remOut.start, T.remOut.dur);

  // ---------- chore bubbles (repelled, arc over the head into the logo) ----------
  const chaosPull = easeProg(frame, 105, 55) * (1 - easeProg(frame, T.remOut.start, T.remOut.dur));
  const logoCx = L.logo.x + L.logo.size / 2;
  const logoCy = L.logo.y + L.logo.size / 2;
  const headX = L.desk.x + seated.head[0] * L.desk.scale;
  const headY = L.desk.y + seated.head[1] * L.desk.scale;
  const absorbMax = easeProg(frame, 230, 40);
  const tangleOp = bump(frame, 105, 135, 165, 195) * (1 - absorbMax) * 0.65;
  const { capsules: bodyCaps, head: headCap } = seatedCapsules(seated, L.desk);
  const bubbles = CHORES.map((_, i) => {
    const a = easeProg(frame, T.absorb.first + i * T.absorb.stagger, T.absorb.dur);
    const flight = a;
    const opacity = 1 - a;
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
      logoRect: { x: L.logo.x, y: L.logo.y, w: L.logo.size, h: L.logo.size },
      logoClearActive: frame >= T.logoIn.start,
      capsules: bodyCaps,
      head: headCap,
    });
    const scale = 1 - 0.62 * flight;
    return { x, y, opacity, scale, r: br };
  });


  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.paper }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: "absolute", inset: 0 }}
      >
        {/* ——— the desk (ONE scene for the whole film) ——— */}
        <g>
          <g transform={`translate(${L.desk.x} ${L.desk.y}) scale(${L.desk.scale})`}>
            <DeskFurniture glow={glow} />
            <Person pose={seated} breathe={breath} headBob={headBob} />
          </g>
        </g>

        {/* ——— relief: the S of ordered stages, right of the desk ——— */}
        <g opacity={retOut}>

          {/* one clean line — the S of ordered stages */}
          <path
            d={stageD}
            fill="none"
            stroke={COLORS.green[700]}
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={stageLen}
            strokeDashoffset={stageLen * (1 - threadProg)}
            opacity={0.9}
          />
          {STAGES.map((kind, i) => {
            const [cx, cy] = L.stagePoints[i + 1];
            const pop = stagePop(i);
            const on = stageOn(i);
            const lightStart = T.stageLight.first + i * T.stageLight.perStage;
            const pulse = 1 + 0.07 * Math.sin(Math.PI * clamp01((frame - lightStart) / 10));
            const sc = (0.55 + 0.45 * pop) * pulse;
            return (
              <g key={kind} transform={`translate(${cx} ${cy}) scale(${sc})`} opacity={pop}>
                <g opacity={1 - on}>
                  <Disc x={0} y={0} r={L.stageR} ring={COLORS.line} fill={COLORS.paperHigh}>
                    <StageIcon kind={kind} color={COLORS.inkMute} cut={COLORS.paperHigh} />
                  </Disc>
                </g>
                <g opacity={on}>
                  <Disc x={0} y={0} r={L.stageR} ring={COLORS.green[300]} fill={COLORS.green[50]}>
                    <StageIcon kind={kind} color={COLORS.green[600]} cut={COLORS.green[50]} />
                  </Disc>
                </g>
              </g>
            );
          })}
          <CheckBadge
            x={L.check.x}
            y={L.check.y}
            r={L.check.r}
            scale={checkScale}
            draw={checkDraw}
            opacity={checkOp}
          />
          <VideoCue
            x={L.cue.x}
            y={L.cue.y}
            w={L.cue.w}
            lift={12 * cueProg}
            pulse={Math.sin(Math.PI * cueProg)}
            opacity={cueOp}
          />
        </g>

        {/* ——— tangled chores ——— */}
        {([[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0]] as const).map(
          ([a, b], k) => {
            const p1 = bubbles[a];
            const p2 = bubbles[b];
            const mx = (p1.x + p2.x) / 2 + (k % 2 ? 34 : -34);
            const my = (p1.y + p2.y) / 2 + (k % 2 ? -26 : 26);
            return (
              <path
                key={k}
                d={`M ${p1.x} ${p1.y} Q ${mx} ${my} ${p2.x} ${p2.y}`}
                fill="none"
                stroke={COLORS.inkFaint}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeDasharray="1 9"
                opacity={tangleOp}
              />
            );
          },
        )}
        {CHORES.map((kind, i) => (
          <g
            key={kind}
            opacity={bubbles[i].opacity}
            transform={`translate(${bubbles[i].x} ${bubbles[i].y}) scale(${bubbles[i].scale})`}
          >
            <Disc x={0} y={0} r={bubbles[i].r} ring={COLORS.line} fill={COLORS.paperHigh}>
              <ChoreIcon kind={kind} color={COLORS.inkMute} cut={COLORS.paperHigh} />
            </Disc>
          </g>
        ))}

        {/* ——— the little clock ——— */}
        <g opacity={clockOp * retOut} transform={`translate(${L.clock.x} ${L.clock.y})`}>
          <Clock r={L.clock.r} minuteAngle={minuteAngle} hourAngle={hourAngle} />
        </g>
      </svg>

      {/* ——— logo: hero of scene 3, calm worker of scene 4 ——— */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: logoCx - L.logo.size * 0.95,
          top: logoCy - L.logo.size * 0.95,
          width: L.logo.size * 1.9,
          height: L.logo.size * 1.9,
          opacity: logoOp * bloom,
          background: `radial-gradient(closest-side, ${COLORS.green[300]}59 0%, transparent 100%)`,
        }}
      />
      <LogoCard
        x={L.logo.x}
        y={L.logo.y}
        size={L.logo.size}
        scale={logoScale}
        opacity={logoOp}
        bloom={bloom}
      />
    </AbsoluteFill>
  );
};
