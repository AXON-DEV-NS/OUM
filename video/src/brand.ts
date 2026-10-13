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
 * ROUND 5 timeline (frames @30fps):
 *   tired    0–105 (slump develops)   chaos   105–195
 *   gather   195–285                   relief  285–404
 *   return   405–480 (wipe back completes by f418)
 */
export const TIMELINE = {
  poseUprightToSlump: { start: 0, dur: 90 },
  poseTiredToOverwhelmed: { start: 100, dur: 50 },
  poseOverwhelmedToCalm: { start: 185, dur: 45 },
  poseCalmToNeutral: { start: 426, dur: 54 },

  clockIn: { start: 85, dur: 20 },
  clockOut: { start: 165, dur: 20 },
  clockChaos: { start: 95, end: 175 },

  logoIn: { start: 180, dur: 30 },
  logoOut: { start: 396, dur: 36 },
  absorb: { first: 190, stagger: 5, dur: 15 },

  /** real circular mask reveal: f240 to f276 (36 frames = 1.2s) */
  wipeIn: { start: 240, dur: 36 },
  /** mirrored feathered out-wipe: f396 to f432 (36 frames = 1.2s) */
  wipeOut: { start: 396, dur: 36 },

  threadDraw: { start: 276, dur: 30 },
  stagesPop: { first: 280, stagger: 4, dur: 10 },
  stageLight: { first: 296, perStage: 6, dur: 6 },
  checkDraw: { start: 336, dur: 12 },
  publishCue: { start: 340, dur: 11 },
  payoffHold: { start: 351, end: 396 }, // 45 frames (1.50s) HOLD

  moonToSun: { start: 280, dur: 40 },
  stars: { inStart: 270, inEnd: 295, outStart: 385, outEnd: 410 },

  bubblesReturn: { start: 426, dur: 40 },
} as const;

/** Seated scene local frame: floor y=460, character faces +x. */
export const DESK_GROUND_LOCAL = 460;
export const REST_GROUND_LOCAL = 420;
export const HEAD_LOCAL: readonly [number, number] = [216, 138];

export interface Layout {
  width: number;
  height: number;
  zone: { x: number; y: number; w: number; h: number };
  desk: { x: number; y: number; scale: number };
  rest: { x: number; y: number; scale: number };
  /** 7 chore discs: [x, y, r] — repel keeps them off the character. */
  chores: readonly (readonly [number, number, number])[];
  logo: { x: number; y: number; size: number };
  wipeCenter: readonly [number, number];
  wipeR0: number;
  wipeR1: number;
  /**
   * Stage path: point 0 = anchor (no disc), points 1..8 = the eight stage
   * discs, then the line continues to `check`.
   */
  stagePoints: readonly (readonly [number, number])[];
  check: { x: number; y: number; r: number };
  cue: { x: number; y: number; w: number };
  sky: { x: number; y: number; r: number };
  clock: { x: number; y: number; r: number };
  stageR: number;
}

export const LAYOUTS: Record<"desktop" | "mobile", Layout> = {
  desktop: {
    width: 1920,
    height: 1080,
    zone: { x: 1000, y: 100, w: 860, h: 880 },
    desk: { x: 940, y: 327, scale: 1.18 },
    rest: { x: 980, y: 526, scale: 1.07 },
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
    wipeCenter: [1580, 480],
    wipeR0: 145.8,
    wipeR1: 800.9,
    stagePoints: [
      [1620, 450],
      [1570, 520],
      [1440, 520],
      [1310, 520],
      [1180, 520],
      [1180, 650],
      [1310, 650],
      [1440, 650],
      [1570, 650],
    ],
    check: { x: 1610, y: 740, r: 26 },
    cue: { x: 1620, y: 830, w: 110 },
    sky: { x: 1680, y: 380, r: 44 },
    clock: { x: 1680, y: 190, r: 40 },
    stageR: 54,
  },
  mobile: {
    width: 1080,
    height: 1350,
    zone: { x: 60, y: 60, w: 960, h: 1230 },
    desk: { x: 260, y: 460, scale: 1.15 },
    rest: { x: 380, y: 840, scale: 1.02 },
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
    wipeCenter: [500, 780],
    wipeR0: 20,
    wipeR1: 720,
    stagePoints: [
      [150, 340],
      [210, 400],
      [430, 400],
      [650, 400],
      [870, 400],
      [870, 580],
      [650, 580],
      [430, 580],
      [210, 580],
    ],
    check: { x: 210, y: 715, r: 26 },
    cue: { x: 210, y: 820, w: 110 },
    sky: { x: 880, y: 480, r: 44 },
    clock: { x: 880, y: 240, r: 36 },
    stageR: 65,
  },
} as const;
