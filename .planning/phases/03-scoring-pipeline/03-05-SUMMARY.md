---
phase: 03-scoring-pipeline
plan: 05
subsystem: background-service-worker
tags: [scoring, orchestration, message-passing, tdd]
dependency_graph:
  requires: [03-02, 03-03, 03-04]
  provides: [EVALUATE-handler, EvaluateMessage, EvaluateResult]
  affects: [popup-evaluate-button, candidate-storage]
tech_stack:
  added: []
  patterns: [exported-function-testability, module-level-state-setter-for-test]
key_files:
  created: []
  modified:
    - linkedin-hhrh-screener/src/shared/messages.ts
    - linkedin-hhrh-screener/entrypoints/background.ts
    - linkedin-hhrh-screener/tests/background.test.ts
decisions:
  - "handleEvaluate exported as named function: enables direct unit testing without browser.runtime message plumbing (same pattern as validateStoredApiKey)"
  - "_setLastParsedProfileForTest exported for test state injection: fakeBrowser.sendMessage cannot work without registered listeners; direct setter avoids message round-trip in tests"
  - "EvaluateResult returns zero-value fields on error: caller checks error field first; avoids partial object shapes"
metrics:
  duration_minutes: 10
  completed_date: "2026-03-10"
  tasks_completed: 2
  files_modified: 3
---

# Phase 03 Plan 05: Background EVALUATE Handler Summary

**One-liner:** EVALUATE message handler wiring scorer modules (keyword pass + Claude refinement + tier assignment) into background.ts orchestration with full guard conditions and 80 tests GREEN.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Extend messages.ts with EVALUATE types | 497b91f | src/shared/messages.ts |
| 2 | Add EVALUATE handler to background.ts + tests | 2d88987 | entrypoints/background.ts, tests/background.test.ts |

## Decisions Made

1. **handleEvaluate as exported named function:** Follows the established `validateStoredApiKey` pattern — extracted handler is directly importable in unit tests without needing browser.runtime message plumbing. The message listener simply delegates to it.

2. **_setLastParsedProfileForTest for test state injection:** `fakeBrowser.runtime.sendMessage` throws "No listeners available" because the `defineBackground` listener is not registered in the test environment (WXT's `defineBackground` is a macro). Rather than complex listener setup, a named export setter provides clean direct injection. Underscore prefix signals internal/test-only use.

3. **EvaluateResult always returns full shape on error:** All numeric and array fields are populated with zero-values when error is present, avoiding TypeScript partial-object problems. Popup caller checks `result.error` first before reading other fields.

## What Was Built

### messages.ts additions
- `EvaluateMessage` interface (`type: 'EVALUATE'`)
- `EvaluateResult` interface with `score`, `tier`, `tierLabel`, `matchedSkills`, `missingSkills`, `rationale`, `candidateId`, `error?`
- `Tier` import from `../scorer/tiers`
- Updated `MessageType` and `ExtensionMessage` unions

### background.ts additions
- All new imports: `runKeywordPass`, `computeScore`, `assignTier`, `TIER_LABELS`, `refineWithClaude`, `getActiveJdId`, `getAllJds`, `saveCandidate`, `CandidateRecord`, `EvaluateResult`
- `handleEvaluate()` — exported async function containing full orchestration:
  - Guard: null lastParsedProfile → error
  - Guard: no API key → error
  - Guard: no active JD id → error
  - Guard: active JD id not found in storage → error
  - Guard: JD skills array empty → error
  - Keyword pass via `runKeywordPass`
  - Claude refinement via `refineWithClaude` (only when unmatchedSkills > 0)
  - `computeScore` over final matched set
  - `assignTier` + `TIER_LABELS` lookup
  - Missing skills = mandatory unmatched only
  - `CandidateRecord` built with `crypto.randomUUID()`, L3 contactAfter (+7 days), expiresAt (+90 days)
  - `saveCandidate` persists to storage
- `_setLastParsedProfileForTest()` — internal test helper
- EVALUATE branch in message listener: delegates to `handleEvaluate().then(sendResponse)`, returns `true`

### background.test.ts additions
- 8 new `handleEvaluate` test cases covering all guard conditions and happy paths
- L3 contactAfter date precision test (within 1 second of 7-day offset)
- Non-L3 candidate has no contactAfter
- Happy path verifies candidate persisted in storage via `getAllCandidates()`

## Test Results

```
Test Files  5 passed (5)
     Tests  80 passed (80)
  Duration  601ms
```

Files: scorer.test.ts (19), storage.test.ts (23), background.test.ts (12), content.test.ts (10), parser.test.ts (16)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Exported _setLastParsedProfileForTest for test isolation**
- **Found during:** Task 2 (TDD RED phase)
- **Issue:** `fakeBrowser.runtime.sendMessage` throws "No listeners available" when called without registered runtime listeners. The `defineBackground` macro does not register listeners in the Vitest environment.
- **Fix:** Exported `_setLastParsedProfileForTest(value)` from background.ts to allow direct module-level state injection in tests, avoiding message round-trip entirely.
- **Files modified:** entrypoints/background.ts, tests/background.test.ts
- **Commit:** 2d88987

## Self-Check: PASSED

- messages.ts: FOUND
- background.ts: FOUND
- background.test.ts: FOUND
- 03-05-SUMMARY.md: FOUND
- Commits 497b91f and 2d88987: FOUND
- All 80 tests GREEN
