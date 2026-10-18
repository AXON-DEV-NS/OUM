/**
 * Skill loader: conditional loading by stage + run path, plus integrity
 * validation used by the tests (versions pinned, goals documented, examples
 * present, judge skills marked).
 */
import type { RunPath } from "@/src/pipeline/store";
import type { StageKey } from "@/src/pipeline/stage";
import { REGISTRY } from "./registry";
import type { SkillDefinition, SkillPath } from "./_types";

export const SEMVER_RE = /^\d+\.\d+\.\d+$/;

export function pathSkills(path: RunPath): SkillPath[] {
  if (path === "MIXED") return ["any", "avatar", "faceless"];
  if (path === "AVATAR") return ["any", "avatar"];
  return ["any", "faceless"];
}

/** all skills of a stage that apply to the run path (conditional loading) */
export function skillsForStage(stageKey: StageKey, path: RunPath): Record<string, SkillDefinition> {
  const allowed = pathSkills(path);
  const out: Record<string, SkillDefinition> = {};
  for (const [key, def] of Object.entries(REGISTRY)) {
    if (def.stages.includes(stageKey) && allowed.includes(def.path)) out[key] = def;
  }
  return out;
}

export function getSkill(key: string): SkillDefinition | null {
  return REGISTRY[key] ?? null;
}

export function skillVersions(skills: Record<string, SkillDefinition>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, def] of Object.entries(skills)) out[key] = def.version;
  return out;
}

export function allSkills(): SkillDefinition[] {
  return Object.values(REGISTRY);
}

/** returns a list of human-readable problems; empty array == healthy */
export function auditRegistry(): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const [key, def] of Object.entries(REGISTRY)) {
    if (def.key !== key) problems.push(`${key}: key mismatch (${def.key})`);
    if (seen.has(def.key)) problems.push(`${key}: duplicate key`);
    seen.add(def.key);
    if (!SEMVER_RE.test(def.version)) problems.push(`${key}: version not semver (${def.version})`);
    if (def.goal.trim().length < 20) problems.push(`${key}: goal too short`);
    if (def.path !== "any" && def.path !== "avatar" && def.path !== "faceless") problems.push(`${key}: bad path ${def.path}`);
    if (!Array.isArray(def.stages) || def.stages.length === 0) problems.push(`${key}: no stages`);
    if (!Array.isArray(def.checklist) || def.checklist.length === 0) problems.push(`${key}: empty checklist`);
    if (!Array.isArray(def.examples) || def.examples.length === 0) problems.push(`${key}: no golden examples`);
    if (def.implemented && typeof def.run !== "function") problems.push(`${key}: implemented but no run()`);
    if (!def.implemented && !def.reason) problems.push(`${key}: not implemented without a reason`);
  }
  return problems;
}
