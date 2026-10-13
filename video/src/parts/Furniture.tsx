import React from "react";
import { COLORS } from "../brand";

/**
 * ROUND 7B furniture — solid shapes with real visual weight:
 * - desk: 20px solid mid-tone tabletop (not an outline)
 * - chair: seat top y=336 so the thighs (mass 334–370) rest on it
 * - laptop closer to the figure, screen back visible at ~105°
 * - glow takes a prop (tired = dimmer, calm = brighter)
 * The sofa + sky were removed with the R7B single-scene design.
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
    <rect x={172} y={178} width={24} height={158} rx={9} fill={COLORS.paperHigh} stroke={COLORS.inkSoft} strokeWidth={6} />
    <rect x={160} y={336} width={150} height={20} rx={9} fill={COLORS.paperHigh} stroke={COLORS.inkSoft} strokeWidth={6} />
    <rect x={192} y={356} width={16} height={104} rx={7} fill={COLORS.paperHigh} stroke={COLORS.inkSoft} strokeWidth={5} />
    <rect x={272} y={356} width={16} height={104} rx={7} fill={COLORS.paperHigh} stroke={COLORS.inkSoft} strokeWidth={5} />

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
