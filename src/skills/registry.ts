/**
 * The single source of truth mapping skill keys -> definitions.
 * 50 skills: 46 implemented (code + llm), 4 registered wave-2 stubs with
 * explicit reasons (vision / YouTube APIs). See each file for its contract.
 */
import type { SkillDefinition } from "./_types";

// ── S0: setup ────────────────────────────────────────────────────
import { instructionsConverter } from "./s00/instructions-converter";
import { conflictDetector } from "./s00/conflict-detector";
import { competitorAnalyzer } from "./s00/competitor-analyzer";
import { referenceDecomposer } from "./s00/reference-decomposer";
import { avatarImageChecker } from "./s00/avatar-image-checker";
import { audienceEmbedder } from "./s00/audience-embedder";
// ── S1: preflight ────────────────────────────────────────────────
import { healthMonitor } from "./s01/health-monitor";
import { quotaCostCalculator } from "./s01/quota-cost-calculator";
// ── S2: research ─────────────────────────────────────────────────
import { trendScout } from "./s02/trend-scout";
import { ideaScorer } from "./s02/idea-scorer";
import { dedupDetector } from "./s02/dedup-detector";
import { seriesPlanner } from "./s02/series-planner";
// ── S3: script ───────────────────────────────────────────────────
import { hookWriter } from "./s03/hook-writer";
import { retentionStructurer } from "./s03/retention-structurer";
import { nicheWriter } from "./s03/niche-writer";
import { dialectPolisher } from "./s03/dialect-polisher";
import { claimsExtractor } from "./s03/claims-extractor";
import { claimsVerifier } from "./s03/claims-verifier";
import { brandRulesEnforcer } from "./s03/brand-rules-enforcer";
// ── S4: storyboard ───────────────────────────────────────────────
import { sceneDirector } from "./s04/scene-director";
import { avatarFingerprintGuard } from "./s04/avatar-fingerprint-guard";
import { voiceDirector } from "./s04/voice-director";
import { licensedMusicPicker } from "./s04/licensed-music-picker";
// ── S5: assets ───────────────────────────────────────────────────
import { scenePromptEngineer } from "./s05/scene-prompt-engineer";
import { deformityDetector } from "./s05/deformity-detector";
import { fallbackPicker } from "./s05/fallback-picker";
// ── S6: render ───────────────────────────────────────────────────
import { editListBuilder } from "./s06/edit-list-builder";
import { paceDoctor } from "./s06/pace-doctor";
import { arabicSubtitleFormatter } from "./s06/arabic-subtitle-formatter";
import { loudnessTuner } from "./s06/loudness-tuner";
// ── S7: seo ──────────────────────────────────────────────────────
import { titleLab } from "./s07/title-lab";
import { thumbnailCopywriter } from "./s07/thumbnail-copywriter";
import { designDescriber } from "./s07/design-describer";
import { seoWriter } from "./s07/seo-writer";
import { chaptersBuilder } from "./s07/chapters-builder";
import { disclosureSetter } from "./s07/disclosure-setter";
// ── S8: final QA ─────────────────────────────────────────────────
import { deterministicChecklist } from "./s08/deterministic-checklist";
import { rightsChecker } from "./s08/rights-checker";
import { sensitiveTopicsGuard } from "./s08/sensitive-topics-guard";
import { promiseMatchJudge } from "./s08/promise-match-judge";
import { originalityJudge } from "./s08/originality-judge";
// ── S9: approval ─────────────────────────────────────────────────
import { approvalSummarizer } from "./s09/approval-summarizer";
import { rejectionTagger } from "./s09/rejection-tagger";
// ── S10: publish ─────────────────────────────────────────────────
import { uploadGuard } from "./s10/upload-guard";
import { bestTimeScheduler } from "./s10/best-time-scheduler";
// ── S11: post-publish ────────────────────────────────────────────
import { publicPageInspector } from "./s11/public-page-inspector";
import { firstHoursAgent } from "./s11/first-hours-agent";
import { ctrDoctor } from "./s11/ctr-doctor";
// ── S12: learning ────────────────────────────────────────────────
import { lessonExtractor } from "./s12/lesson-extractor";
import { weeklyReportWriter } from "./s12/weekly-report-writer";

const ALL: SkillDefinition[] = [
  instructionsConverter, conflictDetector, competitorAnalyzer, referenceDecomposer, avatarImageChecker, audienceEmbedder,
  healthMonitor, quotaCostCalculator,
  trendScout, ideaScorer, dedupDetector, seriesPlanner,
  hookWriter, retentionStructurer, nicheWriter, dialectPolisher, claimsExtractor, claimsVerifier, brandRulesEnforcer,
  sceneDirector, avatarFingerprintGuard, voiceDirector, licensedMusicPicker,
  scenePromptEngineer, deformityDetector, fallbackPicker,
  editListBuilder, paceDoctor, arabicSubtitleFormatter, loudnessTuner,
  titleLab, thumbnailCopywriter, designDescriber, seoWriter, chaptersBuilder, disclosureSetter,
  deterministicChecklist, rightsChecker, sensitiveTopicsGuard, promiseMatchJudge, originalityJudge,
  approvalSummarizer, rejectionTagger,
  uploadGuard, bestTimeScheduler,
  publicPageInspector, firstHoursAgent, ctrDoctor,
  lessonExtractor, weeklyReportWriter,
];

export const REGISTRY: Record<string, SkillDefinition> = Object.fromEntries(ALL.map((s) => [s.key, s]));

export const SKILL_COUNT = ALL.length;
