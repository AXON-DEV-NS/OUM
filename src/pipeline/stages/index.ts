/**
 * The 13 stages of the engine, in order. The engine imports ONLY this file.
 */
import type { StageDefinition, StageKey } from "../stage";
import { s00Setup } from "./s00-setup";
import { s01Preflight } from "./s01-preflight";
import { s02Research } from "./s02-research";
import { s03Script } from "./s03-script";
import { s04Storyboard } from "./s04-storyboard";
import { s05Assets } from "./s05-assets";
import { s06Render } from "./s06-render";
import { s07Seo } from "./s07-seo";
import { s08FinalQa } from "./s08-final-qa";
import { s09Approval } from "./s09-approval";
import { s10Publish } from "./s10-publish";
import { s11PostPublish } from "./s11-post-publish";
import { s12Learning } from "./s12-learning";

/* eslint-disable @typescript-eslint/no-explicit-any */
export const STAGES: StageDefinition<any>[] = [
  s00Setup,
  s01Preflight,
  s02Research,
  s03Script,
  s04Storyboard,
  s05Assets,
  s06Render,
  s07Seo,
  s08FinalQa,
  s09Approval,
  s10Publish,
  s11PostPublish,
  s12Learning,
];

export const STAGE_BY_KEY: Record<StageKey, StageDefinition<any>> = Object.fromEntries(
  STAGES.map((s) => [s.key, s]),
) as Record<StageKey, StageDefinition<any>>;
/* eslint-enable @typescript-eslint/no-explicit-any */

export function stageByIndex(index: number): StageDefinition | null {
  return STAGES[index] ?? null;
}
