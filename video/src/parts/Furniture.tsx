import React from "react";
import { COLORS } from "../brand";

/**
 * ROUND 4 furniture — solid shapes with real visual weight:
 * - desk: 20px solid mid-tone tabletop (not an outline)
 * - chair pulled close: seat edge 30px from the desk edge
 * - laptop closer to the figure, screen back visible at ~105°
 * - glow takes a prop (tired = dimmer, calm = brighter)
 * - sofa: solid shapes; sun/moon in palette tones only (cream + pale green)
 */

export const DeskFurniture: React.FC<{ glow?: number }> = ({ glow = 1 }) => (
  <g>
    <defs>
      <radialGradient id="toolGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor={COLORS.green[300]} stopOpacity={0.38} />
        <stop offset="25%" stopColor={COLORS.green[300]} stopOpacity={0.28} />
        <stop offset="50%" stopColor={COLORS.green[300]} stopOpacity={0.16} />
        <stop offset="75%" stopColor={COLORS.green[300]} stopOpacity={0.06} />
        <stop offset="100%" stopColor={COLORS.green[300]} stopOpacity={0} />
      </radialGradient>
    </defs>

    {/* floor + contact shadows */}
    <rect x={95} y={456} width={660} height={5} rx={2.5} fill={COLORS.line} />
    <ellipse cx={235} cy={458} rx={115} ry={8} fill={COLORS.ink} opacity={0.05} />
    <ellipse cx={555} cy={458} rx={190} ry={8} fill={COLORS.ink} opacity={0.05} />

    {/* chair — thick slabs, pulled close to the desk */}
    <rect x={172} y={178} width={24} height={152} rx={9} fill={COLORS.paperHigh} stroke={COLORS.inkSoft} strokeWidth={6} />
    <rect x={160} y={310} width={150} height={20} rx={9} fill={COLORS.paperHigh} stroke={COLORS.inkSoft} strokeWidth={6} />
    <rect x={192} y={330} width={16} height={128} rx={7} fill={COLORS.paperHigh} stroke={COLORS.inkSoft} strokeWidth={5} />
    <rect x={272} y={330} width={16} height={128} rx={7} fill={COLORS.paperHigh} stroke={COLORS.inkSoft} strokeWidth={5} />

    {/* desk — solid 20px mid-tone tabletop */}
    <rect x={340} y={283} width={400} height={20} rx={7} fill={COLORS.paperLow} stroke={COLORS.line} strokeWidth={5} />
    <rect x={368} y={303} width={18} height={155} rx={7} fill={COLORS.paperHigh} stroke={COLORS.line} strokeWidth={5} />
    <rect x={735} y={303} width={18} height={155} rx={7} fill={COLORS.paperHigh} stroke={COLORS.line} strokeWidth={5} />

    {/* laptop — closer, glow behind the screen back (~105°) */}
    <ellipse cx={530} cy={222} rx={150} ry={128} fill="url(#toolGlow)" opacity={glow} />
    <rect x={370} y={271} width={150} height={12} rx={5} fill={COLORS.paperHigh} stroke={COLORS.inkSoft} strokeWidth={4.5} />
    <g transform="rotate(15 508 271)">
      <rect x={496} y={171} width={25} height={100} rx={6} fill={COLORS.figDeep} />
      <rect x={501} y={179} width={15} height={84} rx={4} fill={COLORS.figNear} opacity={0.85} />
    </g>

    {/* mug */}
    <rect x={640} y={245} width={30} height={38} rx={7} fill={COLORS.paperHigh} stroke={COLORS.inkSoft} strokeWidth={4.5} />
    <path d="M670 255 a12 12 0 0 1 0 20" fill="none" stroke={COLORS.inkSoft} strokeWidth={4.5} strokeLinecap="round" />
  </g>
);

export const RestFurniture: React.FC = () => (
  <g>
    {/* contact shadow + floor */}
    <rect x={30} y={416} width={640} height={5} rx={2.5} fill={COLORS.line} />
    <ellipse cx={330} cy={418} rx={330} ry={11} fill={COLORS.ink} opacity={0.05} />

    {/* sofa — solid shapes */}
    <rect x={16} y={168} width={110} height={180} rx={18} fill={COLORS.paperHigh} stroke={COLORS.inkSoft} strokeWidth={6} />
    <rect x={40} y={330} width={470} height={58} rx={20} fill={COLORS.paperHigh} stroke={COLORS.inkSoft} strokeWidth={6} />
    <rect x={470} y={286} width={74} height={60} rx={16} fill={COLORS.paperHigh} stroke={COLORS.inkSoft} strokeWidth={6} />
    <rect x={70} y={388} width={16} height={32} rx={7} fill={COLORS.paperHigh} stroke={COLORS.inkSoft} strokeWidth={5} />
    <rect x={300} y={388} width={16} height={32} rx={7} fill={COLORS.paperHigh} stroke={COLORS.inkSoft} strokeWidth={5} />
    <rect x={450} y={388} width={16} height={32} rx={7} fill={COLORS.paperHigh} stroke={COLORS.inkSoft} strokeWidth={5} />
    <rect x={520} y={388} width={16} height={32} rx={7} fill={COLORS.paperHigh} stroke={COLORS.inkSoft} strokeWidth={5} />

    {/* cushion under the head */}
    <rect x={26} y={200} width={116} height={56} rx={22} fill={COLORS.paperLow} stroke={COLORS.line} strokeWidth={4.5} />

    {/* side table + tea */}
    <rect x={560} y={330} width={96} height={14} rx={7} fill={COLORS.paperLow} stroke={COLORS.line} strokeWidth={5} />
    <rect x={578} y={344} width={12} height={76} rx={5} fill={COLORS.paperHigh} stroke={COLORS.line} strokeWidth={4.5} />
    <rect x={626} y={344} width={12} height={76} rx={5} fill={COLORS.paperHigh} stroke={COLORS.line} strokeWidth={4.5} />
    <rect x={598} y={292} width={28} height={38} rx={7} fill={COLORS.paperHigh} stroke={COLORS.inkSoft} strokeWidth={4.5} />
    <path d="M626 302 a11 11 0 0 1 0 18" fill="none" stroke={COLORS.inkSoft} strokeWidth={4.5} strokeLinecap="round" />

    {/* closed laptop, put away */}
    <rect x={10} y={404} width={58} height={14} rx={6} fill={COLORS.paperHigh} stroke={COLORS.inkSoft} strokeWidth={4.5} />
  </g>
);

export const Clock: React.FC<{
  r: number;
  minuteAngle: number;
  hourAngle: number;
}> = ({ r, minuteAngle, hourAngle }) => (
  <g>
    <circle cx={0} cy={4} r={r} fill={COLORS.ink} opacity={0.07} />
    <circle cx={0} cy={0} r={r} fill={COLORS.paperHigh} stroke={COLORS.line} strokeWidth={4} />
    {[0, 90, 180, 270].map((a) => (
      <line
        key={a}
        x1={0}
        y1={-r * 0.78}
        x2={0}
        y2={-r * 0.62}
        stroke={COLORS.inkFaint}
        strokeWidth={3.5}
        strokeLinecap="round"
        transform={`rotate(${a})`}
      />
    ))}
    <line x1={0} y1={0} x2={0} y2={-r * 0.5} stroke={COLORS.inkSoft} strokeWidth={5.5} strokeLinecap="round" transform={`rotate(${hourAngle})`} />
    <line x1={0} y1={0} x2={0} y2={-r * 0.74} stroke={COLORS.inkSoft} strokeWidth={5.5} strokeLinecap="round" transform={`rotate(${minuteAngle})`} />
    <circle cx={0} cy={0} r={4.5} fill={COLORS.inkSoft} />
  </g>
);

const STAR_POSITIONS: readonly (readonly [number, number])[] = [
  [-1.9, -0.7],
  [-2.4, 0.5],
  [-1.1, -1.6],
  [1.9, -1.2],
  [2.5, 0.3],
  [0.6, -2.1],
];

/**
 * Night→day in palette tones only (cream + pale green):
 * filled crescent moon (no outline ring) → pale-green sun.
 */
export const Sky: React.FC<{
  r: number;
  moonOpacity: number;
  sunP: number;
  sunRot: number;
  starOpacity: number;
  phase: number;
}> = ({ r, moonOpacity, sunP, sunRot, starOpacity, phase }) => (
  <g>
    <defs>
      <radialGradient id="skyHalo" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor={COLORS.green[100]} stopOpacity={0.55} />
        <stop offset="100%" stopColor={COLORS.green[100]} stopOpacity={0} />
      </radialGradient>
    </defs>

    {STAR_POSITIONS.map(([dx, dy], i) => (
      <circle
        key={i}
        cx={dx * r}
        cy={dy * r}
        r={3.4}
        fill={COLORS.green[300]}
        opacity={starOpacity * (0.3 + 0.7 * Math.max(0, Math.sin(phase + i * 1.1)))}
      />
    ))}

    {/* moon — filled pale-cream crescent, no outline ring */}
    <g opacity={moonOpacity}>
      <circle cx={0} cy={0} r={r * 1.7} fill="url(#skyHalo)" />
      <circle cx={0} cy={0} r={r} fill={COLORS.paperHigh} />
      <circle cx={r * 0.34} cy={-r * 0.26} r={r * 0.82} fill={COLORS.paper} />
      <circle cx={-r * 0.3} cy={r * 0.3} r={r * 0.1} fill={COLORS.paperLow} />
      <circle cx={-r * 0.05} cy={-r * 0.35} r={r * 0.07} fill={COLORS.paperLow} />
    </g>

    {/* sun — pale green disc, rising */}
    <g opacity={sunP} transform={`translate(0 ${(1 - sunP) * r * 2.2})`}>
      <circle cx={0} cy={0} r={r * 1.9} fill="url(#skyHalo)" />
      <g transform={`rotate(${sunRot})`}>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <line key={a} x1={r * 0.98} y1={0} x2={r * 1.28} y2={0} stroke={COLORS.green[400]} strokeWidth={6} strokeLinecap="round" transform={`rotate(${a})`} />
        ))}
      </g>
      <circle cx={0} cy={0} r={r * 0.72} fill={COLORS.green[300]} />
    </g>
  </g>
);
