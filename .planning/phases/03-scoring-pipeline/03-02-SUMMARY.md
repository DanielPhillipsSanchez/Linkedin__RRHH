---
phase: 03-scoring-pipeline
plan: 02
subsystem: scoring
tags: [keyword-matching, scoring, tiers, typescript, vitest, tdd]

# Dependency graph
requires:
  - phase: 03-01
    provides: "scorer.test.ts (RED), scorer.ts/tiers.ts/claude.ts skeleton files"
provides:
  - "skillMatches: bidirectional substring keyword matching with normalisation"
  - "computeScore: weighted scoring (mandatory=2, nice-to-have=1) as rounded percentage"
  - "runKeywordPass: partitions JD skills into matched strings and unmatched Skill objects"
  - "assignTier: exact threshold tier assignment (>=80 L1, >=71 L2, >=60 L3, else rejected)"
  - "TIER_LABELS: human-readable tier names (Layer 1, Layer 2, Layer 3, Rejected)"
affects:
  - 03-03-claude-refinement
  - 03-05-scoring-orchestrator

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "normalise(): lowercase + strip non-alphanumeric chars before string comparison"
    - "bidirectional substring: csNorm.includes(jdNorm) || jdNorm.includes(csNorm)"
    - "computeScore receives Set<string> of JD skill text strings (verbatim, not normalised)"
    - "runKeywordPass returns matchedSkills as string[] (JD text verbatim) for computeScore compatibility"

key-files:
  created: []
  modified:
    - linkedin-hhrh-screener/src/scorer/scorer.ts
    - linkedin-hhrh-screener/src/scorer/tiers.ts

key-decisions:
  - "computeScore Set<string> uses verbatim JD skill text (not normalised) — caller (runKeywordPass) controls what goes into the set; normalisation happens inside skillMatches only"
  - "runKeywordPass returns unmatchedSkills as full Skill[] (both weights) — SCORE-07 mandatory-only display filter is the caller's responsibility, not the keyword pass"
  - "Tier thresholds are hardcoded if-chain, not configurable constants — product requirement, v2 feature"

patterns-established:
  - "normalise() is a private helper — not exported. External callers use skillMatches."
  - "WEIGHT const typed as Record<Skill['weight'], number> for exhaustive key coverage"

requirements-completed:
  - SCORE-01
  - SCORE-03
  - SCORE-04
  - SCORE-06
  - SCORE-07

# Metrics
duration: 8min
completed: 2026-03-10
---

# Phase 3 Plan 02: Keyword Scoring Engine Summary

**Keyword scoring engine with bidirectional substring matching, weighted mandatory/nice-to-have scoring, and exact-threshold tier assignment (L1/L2/L3/rejected)**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-10T08:20:00Z
- **Completed:** 2026-03-10T08:21:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Implemented `skillMatches()` with normalisation (lowercase + strip punctuation) and bidirectional substring — catches React/React.js, Node/Node.js, machine learning/Machine Learning Engineer
- Implemented `computeScore()` with mandatory=2, nice-to-have=1 weights returning a rounded percentage (0 when no skills)
- Implemented `runKeywordPass()` that partitions JD skills into `matchedSkills` (string[]) and `unmatchedSkills` (Skill[])
- Implemented `assignTier()` with exact boundaries: >=80 → L1, >=71 → L2, >=60 → L3, else rejected
- Filled `TIER_LABELS` with human-readable values: Layer 1, Layer 2, Layer 3, Rejected
- 16/19 scorer tests GREEN; 3 remaining RED are `refineWithClaude` (Plan 03-03 scope)

## Task Commits

Each task was committed atomically:

1. **Task 1: scorer.ts — keyword normalisation, match, weighted score** - `c45e0e8` (feat)
2. **Task 2: tiers.ts — tier thresholds and label map** - `57e46a2` (feat)

_TDD GREEN phase: skeleton → full implementation_

## Files Created/Modified

- `linkedin-hhrh-screener/src/scorer/scorer.ts` - normalise(), skillMatches(), computeScore(), runKeywordPass()
- `linkedin-hhrh-screener/src/scorer/tiers.ts` - Tier type, TIER_LABELS, assignTier()

## Decisions Made

- `computeScore` receives a `Set<string>` of verbatim JD skill text strings. `runKeywordPass` pushes `skill.text` directly into `matchedSkills`, so callers can build the set without re-normalising.
- `runKeywordPass` returns `unmatchedSkills` as `Skill[]` (all weights). The SCORE-07 mandatory-only display filter (`unmatchedSkills.filter(s => s.weight === 'mandatory')`) is the caller's responsibility — the keyword pass stays policy-agnostic.
- Tier thresholds are hardcoded (product requirement). Configurable thresholds deferred to v2.

## Deviations from Plan

None — plan executed exactly as written. 03-01 scaffold was already in place (committed via `b8fde2b`); the scorer directory appeared missing due to a git untracked state, but skeleton files existed and tests were already RED.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `scorer.ts` and `tiers.ts` fully implemented and tested
- `claude.ts` remains skeleton — Plan 03-03 implements `refineWithClaude()`
- Plan 03-05 (scoring orchestrator) can now import `runKeywordPass`, `computeScore`, and `assignTier` directly

---
*Phase: 03-scoring-pipeline*
*Completed: 2026-03-10*
