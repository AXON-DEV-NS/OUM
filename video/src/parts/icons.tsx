import React from "react";
import { COLORS } from "../brand";

/**
 * ROUND 3 icon family — SOLID/duotone silhouettes, one grid (48×48), one
 * shaping language. Main tone is passed in (`color`); details are cut in the
 * disc's own fill colour (`cut`) so they always read. No text, ever.
 */

export type ChoreKind =
  | "images"
  | "video"
  | "voice"
  | "edit"
  | "publish"
  | "calendar"
  | "money";

export type StageKind =
  | "connect"
  | "research"
  | "script"
  | "video"
  | "voice"
  | "edit"
  | "publish"
  | "optimize";

const S = 3.2; // minimum detail stroke

export const ChoreIcon: React.FC<{ kind: ChoreKind; color: string; cut: string }> = ({
  kind,
  color,
  cut,
}) => {
  const body = (() => {
    switch (kind) {
      case "images":
        return (
          <>
            <rect x={8} y={12} width={32} height={24} rx={4.5} fill={color} />
            <circle cx={17} cy={20} r={2.7} fill={cut} />
            <path d="M12 31 L19 24 L25 29 L30 23 L36 30" fill="none" stroke={cut} strokeWidth={S} strokeLinecap="round" strokeLinejoin="round" />
          </>
        );
      case "video":
        return (
          <>
            <rect x={8} y={12} width={32} height={24} rx={5} fill={color} />
            <path d="M21 18.5 L30.5 24 L21 29.5 Z" fill={cut} />
          </>
        );
      case "voice":
        return (
          <>
            <rect x={19} y={9} width={10} height={18} rx={5} fill={color} />
            <path d="M14.5 24 a9.5 9.5 0 0 0 19 0" fill="none" stroke={color} strokeWidth={S} strokeLinecap="round" />
            <path d="M24 33.5 V38" fill="none" stroke={color} strokeWidth={S} strokeLinecap="round" />
            <path d="M19 39.5 H29" fill="none" stroke={color} strokeWidth={S} strokeLinecap="round" />
            <path d="M10 16 a11 11 0 0 1 0 15" fill="none" stroke={color} strokeWidth={S} strokeLinecap="round" opacity={0.6} />
            <path d="M38 16 a11 11 0 0 0 0 15" fill="none" stroke={color} strokeWidth={S} strokeLinecap="round" opacity={0.6} />
          </>
        );
      case "edit":
        return (
          <>
            <path d="M20 32 L34 11" fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" />
            <path d="M28 32 L14 11" fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" />
            <circle cx={17} cy={35} r={5} fill={color} />
            <circle cx={31} cy={35} r={5} fill={color} />
            <circle cx={17} cy={35} r={2.2} fill={cut} />
            <circle cx={31} cy={35} r={2.2} fill={cut} />
          </>
        );
      case "publish":
        return (
          <>
            <polygon points="24,10 33,20 27,20 27,32 21,32 21,20 15,20" fill={color} />
            <rect x={12} y={34} width={24} height={6} rx={3} fill={color} />
          </>
        );
      case "calendar":
        return (
          <>
            <rect x={9} y={12} width={30} height={26} rx={5} fill={color} />
            <rect x={15} y={8} width={4} height={9} rx={2} fill={color} />
            <rect x={29} y={8} width={4} height={9} rx={2} fill={color} />
            <rect x={14} y={21} width={20} height={3.2} rx={1.6} fill={cut} />
            <rect x={14} y={28} width={13} height={3.2} rx={1.6} fill={cut} />
          </>
        );
      case "money":
        return (
          <>
            <circle cx={24} cy={24} r={13} fill={color} />
            <circle cx={24} cy={24} r={8.2} fill={cut} />
            <rect x={21} y={21} width={6} height={6} rx={2} fill={color} />
          </>
        );
    }
  })();
  return <g>{body}</g>;
};

export const StageIcon: React.FC<{ kind: StageKind; color: string; cut: string }> = ({
  kind,
  color,
  cut,
}) => {
  const body = (() => {
    switch (kind) {
      case "connect":
        return (
          <>
            <rect x={7} y={18} width={20} height={13} rx={6.5} fill="none" stroke={color} strokeWidth={6.5} transform="rotate(-32 17 24.5)" />
            <rect x={21} y={18} width={20} height={13} rx={6.5} fill="none" stroke={color} strokeWidth={6.5} transform="rotate(-32 31 24.5)" />
          </>
        );
      case "research":
        return (
          <>
            <circle cx={21} cy={20} r={11.5} fill={color} />
            <circle cx={21} cy={20} r={6.2} fill={cut} />
            <path d="M28.5 28 L38 37.5" fill="none" stroke={color} strokeWidth={7} strokeLinecap="round" />
          </>
        );
      case "script":
        return (
          <>
            <rect x={12} y={7} width={24} height={34} rx={6} fill={color} />
            <rect x={18} y={15} width={13} height={3.2} rx={1.6} fill={cut} />
            <rect x={18} y={22} width={13} height={3.2} rx={1.6} fill={cut} />
            <rect x={18} y={29} width={8} height={3.2} rx={1.6} fill={cut} />
          </>
        );
      case "video":
        return (
          <>
            <rect x={8} y={11} width={32} height={26} rx={6} fill={color} />
            <path d="M20.5 18 L30.5 24 L20.5 30 Z" fill={cut} />
          </>
        );
      case "voice":
        return (
          <>
            <rect x={19} y={9} width={10} height={18} rx={5} fill={color} />
            <path d="M15 25 a9 9 0 0 0 18 0" fill="none" stroke={color} strokeWidth={S} strokeLinecap="round" />
            <path d="M24 34 V38" fill="none" stroke={color} strokeWidth={S} strokeLinecap="round" />
            <path d="M19.5 39.5 H28.5" fill="none" stroke={color} strokeWidth={S} strokeLinecap="round" />
            <path d="M11 17 a10 10 0 0 1 0 14" fill="none" stroke={color} strokeWidth={S} strokeLinecap="round" />
            <path d="M37 17 a10 10 0 0 0 0 14" fill="none" stroke={color} strokeWidth={S} strokeLinecap="round" />
          </>
        );
      case "edit":
        return (
          <>
            <path d="M20 32 L34 11" fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" />
            <path d="M28 32 L14 11" fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" />
            <circle cx={17} cy={35} r={5} fill={color} />
            <circle cx={31} cy={35} r={5} fill={color} />
            <circle cx={17} cy={35} r={2.2} fill={cut} />
            <circle cx={31} cy={35} r={2.2} fill={cut} />
          </>
        );
      case "publish":
        return (
          <>
            <polygon points="41,7 7,21 21,25.5 25,39" fill={color} />
            <path d="M21 25.5 L41 7" fill="none" stroke={cut} strokeWidth={3} strokeLinecap="round" />
          </>
        );
      case "optimize":
        return (
          <>
            <rect x={11} y={27} width={7.5} height={12.5} rx={3.5} fill={color} />
            <rect x={20.5} y={20} width={7.5} height={19.5} rx={3.5} fill={color} />
            <rect x={30} y={11} width={7.5} height={28.5} rx={3.5} fill={color} />
          </>
        );
    }
  })();
  return <g>{body}</g>;
};

/** Disc with the site's soft-shadow language. */
export const Disc: React.FC<{
  x: number;
  y: number;
  r: number;
  ring: string;
  fill: string;
  children: React.ReactNode;
}> = ({ x, y, r, ring, fill, children }) => (
  <g>
    <circle cx={x} cy={y + 4} r={r} fill={COLORS.ink} opacity={0.07} />
    <circle cx={x} cy={y} r={r} fill={fill} stroke={ring} strokeWidth={3.5} />
    <g
      transform={`translate(${x - (r * 1.2) / 2}, ${y - (r * 1.2) / 2}) scale(${
        (r * 1.2) / 48
      })`}
    >
      {children}
    </g>
  </g>
);

export const CheckBadge: React.FC<{
  x: number;
  y: number;
  r: number;
  scale: number;
  draw: number;
  opacity: number;
}> = ({ x, y, r, scale, draw, opacity }) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={opacity}>
    <circle cx={0} cy={4} r={r} fill={COLORS.ink} opacity={0.07} />
    <circle cx={0} cy={0} r={r} fill={COLORS.green[600]} />
    <path
      d={`M ${-r * 0.42} ${r * 0.02} L ${-r * 0.12} ${r * 0.32} L ${r * 0.45} ${-r * 0.3}`}
      fill="none"
      stroke={COLORS.paperHigh}
      strokeWidth={r * 0.18}
      strokeLinecap="round"
      strokeLinejoin="round"
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - draw}
    />
  </g>
);

/** The YouTube cue — a generic video card that gets "published" at the end. */
export const VideoCue: React.FC<{
  x: number;
  y: number;
  w: number;
  lift: number;
  pulse: number;
  opacity: number;
}> = ({ x, y, w, lift, pulse, opacity }) => {
  const h = w * 0.72;
  return (
    <g transform={`translate(${x} ${y - lift}) scale(${1 + 0.07 * pulse})`} opacity={opacity}>
      <rect x={-w / 2} y={-h / 2 + 5} width={w} height={h} rx={w * 0.12} fill={COLORS.green[400]} opacity={0.25} />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={w * 0.12} fill={COLORS.paperHigh} stroke={COLORS.green[600]} strokeWidth={4} />
      <path
        d={`M ${-w * 0.09} ${-h * 0.14} L ${w * 0.13} 0 L ${-w * 0.09} ${h * 0.14} Z`}
        fill={COLORS.green[600]}
      />
    </g>
  );
};
