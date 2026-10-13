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
  poseOverwhelmedToCalm: { start: 240, dur: 28 },
  poseCalmToRest: { start: 288, dur: 62 },
  poseCalmToNeutral: { start: 405, dur: 75 },

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
      [1480, 230, 52],
      [1620, 310, 46],
      [1640, 520, 38],
      [1540, 140, 36],
    ],
    logo: { x: 1435, y: 335, size: 290 },
    /**
     * R7B: the stage chain lives in the free band above/right of the desk.
     * Top row y=150 sits above the logo box (335); the right column at x≥1776
     * clears the logo's right edge (1725) by ≥51 px and the desk (x≤1436).
     */
    stagePoints: [
      [1060, 150],
      [1200, 150],
      [1340, 150],
      [1480, 150],
      [1620, 150],
      [1760, 150],
      [1830, 300],
      [1830, 450],
      [1830, 600],
    ],
    check: { x: 1830, y: 740, r: 26 },
    cue: { x: 1830, y: 840, w: 110 },
    clock: { x: 1680, y: 190, r: 40 },
    stageR: 54,
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
     * R7B mobile: the chain runs down the right column (x≈900, r=65 →
     * 835–965) clearing the desk's right edge (743) by ≥64 px and the
     * top-centre logo (right edge 630) by ≥177 px.
     */
    stagePoints: [
      [900, 150],
      [872, 280],
      [928, 410],
      [872, 540],
      [928, 670],
      [872, 800],
      [928, 930],
      [880, 1055],
    ],
    check: { x: 905, y: 1175, r: 26 },
    cue: { x: 905, y: 1268, w: 110 },
    clock: { x: 880, y: 240, r: 36 },
    stageR: 65,
  },
} as const;
