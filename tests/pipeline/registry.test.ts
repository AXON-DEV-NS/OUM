/**
 * Skill-registry integrity: versions, goals, checklists, golden examples,
 * conditional loading, and the four explicitly deferred wave-2 skills.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { allSkills, auditRegistry, skillsForStage } from "@/src/skills/loader";

const WAVE2_DEFERRED = ["avatar-fingerprint-guard", "deformity-detector", "first-hours-agent", "ctr-doctor"];

describe("skill registry", () => {
  test("auditRegistry() is clean", () => {
    assert.deepEqual(auditRegistry(), []);
  });

  test("50 skills ship: 46 implemented + 4 explicitly deferred with reasons", () => {
    const skills = allSkills();
    assert.equal(skills.length, 50);
    assert.equal(skills.filter((s) => s.implemented).length, 46);

    const deferred = skills.filter((s) => !s.implemented);
    assert.deepEqual(deferred.map((s) => s.key).sort(), [...WAVE2_DEFERRED].sort());
    for (const s of deferred) {
      assert.ok(s.reason && s.reason.length > 10, `${s.key} must document why it is deferred`);
    }
  });

  test("every skill pins a semver version and documents itself", () => {
    for (const s of allSkills()) {
      assert.match(s.version, /^\d+\.\d+\.\d+$/, s.key);
      assert.ok(s.goal.length >= 20, s.key);
      assert.ok(s.checklist.length > 0, s.key);
      assert.ok(s.examples.length > 0, s.key);
    }
  });

  test("conditional loading: FACELESS runs never load avatar-only skills", () => {
    for (const stageKey of ["S0", "S4", "S5", "S8"] as const) {
      const loaded = skillsForStage(stageKey, "FACELESS");
      for (const def of Object.values(loaded)) {
        assert.ok(["any", "faceless"].includes(def.path), `${def.key} leaked into FACELESS`);
      }
    }
  });

  test("judge skills are marked as judges", () => {
    const judges = allSkills().filter((s) => s.judge);
    assert.deepEqual(
      judges.map((s) => s.key).sort(),
      ["claims-verifier", "originality-judge", "promise-match-judge", "sensitive-topics-guard"],
    );
  });
});
