/**
 * Brand tokens — imported LIVE from the site's own tailwind config so the
 * film can never drift from the site palette. (tailwind.config.ts is the
 * source of truth; `line` lives in app/globals.css.)
 *
 * ROUND 4: figure in theme dark-green tones; logo 290px hero on desktop;
 * stage discs Ø112 desktop / Ø130 mobile; serpentine thread layout.
 */
import tailwindConfig from "../../tailwind.config";

type SiteColors = Record<string, Record<string, string>>;
const siteColors = (tailwindConfig as unknown as {
  theme: { extend: { colors: SiteColors } };
}).theme.extend.colors;

const paper = siteColors.paper;
const ink = siteColors.ink;
const green = siteColors.green;
const gold = siteColors.gold;

export const COLORS = {
  paper: paper.DEFAULT,
  paperHigh: paper.high,
  paperLow: paper.low,
  ink: ink.DEFAULT,
  inkSoft: ink.soft,
  inkMute: ink.mute,
  inkFaint: ink.faint,
  line: "#E3DAC5",
  green: {
    50: green["50"],
    100: green["100"],
    200: green["200"],
    300: green["300"],
    400: green["400"],
    500: green["500"],
    600: green["600"],
    700: green["700"],
    800: green["800"],
  },
  gold: {
    300: gold["300"],
    400: gold["400"],
  },
  /** Figure tones — the theme's dark green, never pure black. */
  figNear: "#3B5138",
  figFar: "#5C7A55",
  figDeep: "#2E4230",
} as const;

export const LOGO_ASSET = "vovo-logo-clean-2048.png" as const;

export const FPS = 30;
export const DURATION_IN_FRAMES = 480; // 16.0s

/**
 * ROUND 7B timeline (frames @30fps) — ONE desk scene, no wipe, no sofa:
 *   upright→tired f0–75 · tired hold · tired→head-in-hand f100–185 ·
 *   head-in-hand hold (chaos) f185–240 · look-up f240–268 (+20 f hold) ·
 *   lean-back relief f288–350 (62 f) · relief hold f350–405 (55 f) ·
 *   relief→upright return f405–480 (75 f = 2.5 s, continuous, loop closes).
 *   Discs fly f235–282 (gather → arc over the head → into the logo).
 *   Relief chain draws f300+; check/card f352+; everything soft-outs f412+.
 */
export const TIMELINE = {
  poseUprightToSlump: { start: 0, dur: 75 },
  poseTiredToOverwhelmed: { start: 100, dur: 85 },
  poseOverwhelmedToCalm: { start: 240, dur: 32 },
  poseCalmToRest: { start: 292, dur: 64 },
  poseCalmToNeutral: { start: 401, dur: 78 },

  clockIn: { start: 85, dur: 20 },
  clockOut: { start: 165, dur: 20 },
  clockChaos: { start: 95, end: 175 },

  logoIn: { start: 225, dur: 30 },
  logoOut: { start: 415, dur: 45 },
  absorb: { first: 235, stagger: 5, dur: 12 },

  threadDraw: { start: 300, dur: 30 },
  stagesPop: { first: 306, stagger: 4, dur: 10 },
  stageLight: { first: 322, perStage: 6, dur: 6 },
  checkDraw: { start: 352, dur: 12 },
  publishCue: { start: 358, dur: 11 },
  payoffHold: { start: 350, end: 405 },
  remOut: { start: 412, dur: 40 },
} as const;

/** Seated scene local frame: floor y=460, character faces +x. */
export const DESK_GROUND_LOCAL = 460;

export interface Layout {
  width: number;
  height: number;
  zone: { x: number; y: number; w: number; h: number };
  desk: { x: number; y: number; scale: number };
  /** 7 chore discs: [x, y, r] — repel keeps them off the character. */
  chores: readonly (readonly [number, number, number])[];
  logo: { x: number; y: number; size: number };
  /**
   * Stage path: point 0 = anchor (no disc), points 1..8 = the eight stage
   * discs, then the line continues to `check`.
   */
  stagePoints: readonly (readonly [number, number])[];
  check: { x: number; y: number; r: number };
  cue: { x: number; y: number; w: number };
  clock: { x: number; y: number; r: number };
  stageR: number;
}

export const LAYOUTS: Record<"desktop" | "mobile", Layout> = {
  desktop: {
    width: 1920,
    height: 1080,
    zone: { x: 1000, y: 100, w: 860, h: 880 },
    desk: { x: 940, y: 327, scale: 1.18 },
    chores: [
      [1050, 330, 48],
      [1160, 220, 56],
      [1320, 180, 42],
      [1360, 240, 52],
      [1830, 250, 46],
      [1690, 710, 38],
      [1540, 110, 36],
    ],
    logo: { x: 1470, y: 208, size: 266 },
    /**
     * R7B: the stage chain lives in the free band above/right of the desk.
     * Top row y=120 (disc bottom 164) leaves 44 px above the logo box (208);
     * the right column (x≥1786) clears the logo right edge (1736) by ≥50 px;
     * its bottom disc (604) sits ≥57 px above the desk top (world 661);
     * check/cue sit below the desk-leg bend with ≥47 px clearance.
     */
    stagePoints: [
      [1060, 120],
      [1200, 120],
      [1340, 120],
      [1480, 120],
      [1620, 120],
      [1760, 120],
      [1830, 290],
      [1830, 425],
      [1830, 560],
    ],
    check: { x: 1850, y: 940, r: 26 },
    cue: { x: 1850, y: 1030, w: 110 },
    clock: { x: 1680, y: 190, r: 40 },
    stageR: 44,
  },
  mobile: {
    width: 1080,
    height: 1350,
    zone: { x: 60, y: 60, w: 960, h: 1230 },
    desk: { x: 260, y: 460, scale: 1.15 },
    chores: [
      [200, 480, 50],
      [220, 680, 52],
      [280, 860, 48],
      [800, 460, 52],
      [840, 660, 54],
      [800, 840, 48],
      [540, 360, 46],
    ],
    logo: { x: 450, y: 70, size: 180 },
    /**
     * R7B mobile: chain hugs the LEFT margin (x≈92–208, r=58) — clear of the
     * chair (x≥444), the figure and the desk slab band; the logo (right edge
     * 630) clears disc 1 by ≥120 px. Check + cue stack below, inside 1350.
     */
    stagePoints: [
      [430, 110],
      [270, 150],
      [150, 280],
      [150, 405],
      [150, 530],
      [150, 655],
      [150, 780],
      [150, 905],
      [150, 1030],
    ],
    check: { x: 150, y: 1145, r: 26 },
    cue: { x: 150, y: 1240, w: 110 },
    clock: { x: 880, y: 240, r: 36 },
    stageR: 58,
  },
} as const;
