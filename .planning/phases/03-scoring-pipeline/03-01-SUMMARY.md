---
phase: 03-scoring-pipeline
plan: 01
subsystem: testing
tags: [vitest, tdd, scorer, keyword-matching, tier-assignment, claude-api]

# Dependency graph
requires:
  - phase: 02-profile-parsing
    provides: CandidateProfile type and parser/types.ts
  - phase: 01-foundation
    provides: Skill and CandidateRecord types in storage/schema.ts
provides:
  - Failing test stubs for scorer module covering SCORE-01/02/03/04/06/07/08
  - Skeleton src/scorer/scorer.ts with skillMatches, computeScore, runKeywordPass
  - Skeleton src/scorer/tiers.ts with assignTier and Tier type
  - Skeleton src/scorer/claude.ts with refineWithClaude
affects: [03-02, 03-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave 0 TDD RED: skeleton files export function names but throw 'not implemented' to allow TypeScript imports to resolve while tests fail with assertion errors"
    - "vi.stubGlobal('fetch', mockFn) pattern for mocking Anthropic API fetch calls (established in Phase 1, reused here)"

key-files:
  created:
    - linkedin-hhrh-screener/tests/scorer.test.ts
    - linkedin-hhrh-screener/src/scorer/scorer.ts
    - linkedin-hhrh-screener/src/scorer/tiers.ts
    - linkedin-hhrh-screener/src/scorer/claude.ts
  modified: []

key-decisions:
  - "runKeywordPass returns unmatchedSkills as Skill[] (not string[]) so callers can filter by weight to derive missingSkills (mandatory-only) without additional data"
  - "Tier boundary: score 70 maps to L3 (not L2); boundary is score >= 71 for L2 — aligns with SCORE-04 requirement (71-79 is L2, 60-70 is L3)"

patterns-established:
  - "Scorer module lives in src/scorer/ directory with three focused files: scorer.ts (keyword pass), tiers.ts (thresholds), claude.ts (API call)"
  - "Wave 0 skeleton pattern: throw new Error('not implemented') in all function bodies; use leading-underscore param names for unused params"

requirements-completed: [SCORE-01, SCORE-02, SCORE-03, SCORE-04, SCORE-06, SCORE-07, SCORE-08]

# Metrics
duration: 5min
completed: 2026-03-10
---

# Phase 3 Plan 01: Scorer Test Scaffold + Skeleton Modules Summary

**19 failing Vitest tests covering keyword matching, weighted scoring, tier assignment, and Claude refinement — all backed by empty-export skeleton modules that resolve TypeScript imports cleanly**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-10T08:19:34Z
- **Completed:** 2026-03-10T08:20:40Z
- **Tasks:** 1 (TDD RED wave)
- **Files modified:** 4

## Accomplishments

- Created tests/scorer.test.ts with 19 failing tests across 5 describe blocks covering all 6 requirement areas (SCORE-01/02/03/04/06/07/08)
- Created src/scorer/scorer.ts skeleton exporting skillMatches, computeScore, runKeywordPass
- Created src/scorer/tiers.ts skeleton exporting Tier type, TIER_LABELS, and assignTier
- Created src/scorer/claude.ts skeleton exporting refineWithClaude (async, typed)
- Verified RED state: 19/19 tests fail with "not implemented" Error — no TypeScript or import errors

## Task Commits

1. **Task 1: TDD RED — scorer test stubs + skeleton modules** - `0d2a092` (test)

**Plan metadata:** (this commit)

## Files Created/Modified

- `linkedin-hhrh-screener/tests/scorer.test.ts` - 19 failing tests for keyword matching, weighted scoring, tier assignment, matchedSkills/missingSkills, and Claude refinement (mocked fetch)
- `linkedin-hhrh-screener/src/scorer/scorer.ts` - Skeleton: skillMatches, computeScore, runKeywordPass (all throw 'not implemented')
- `linkedin-hhrh-screener/src/scorer/tiers.ts` - Skeleton: Tier type, TIER_LABELS, assignTier (throws 'not implemented')
- `linkedin-hhrh-screener/src/scorer/claude.ts` - Skeleton: refineWithClaude async function (throws 'not implemented')

## Decisions Made

- **runKeywordPass returns Skill[] for unmatchedSkills** (not string[]): The caller needs to distinguish mandatory from nice-to-have unmatched skills to derive the display-level "missing skills" list. Returning the full Skill object avoids a separate lookup.
- **Tier 70 = L3 boundary confirmed**: score >= 71 is L2, score >= 60 (and <= 70) is L3. Test cases at 70 and 71 document the exact boundary.

## Deviations from Plan

None — plan executed exactly as written. Skeleton files match the plan's `<implementation>` section verbatim; test cases match the `<behavior>` section exactly.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Wave 0 RED baseline committed; plans 03-02 (keyword pass + tiers) and 03-03 (Claude refinement) can now implement against these failing tests
- All 19 tests will turn GREEN as 03-02 and 03-03 implement the real logic
- No blockers

---
*Phase: 03-scoring-pipeline*
*Completed: 2026-03-10*
