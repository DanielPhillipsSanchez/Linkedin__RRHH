---
phase: 05-scheduling-and-notifications
plan: 01
subsystem: background-service
tags: [browser-alarms, notifications, badge, webextension, tdd, vitest]

# Dependency graph
requires:
  - phase: 03-scoring-pipeline
    provides: handleEvaluate, CandidateRecord with tier/contactAfter fields
  - phase: 04-output-layer
    provides: handleSaveMessage, storage functions (getAllCandidates, getCandidate, saveCandidate)

provides:
  - refreshBadge(): counts overdue uncontacted L3 candidates, sets badge text and color
  - handleAlarm(): processes l3-followup-{id} alarms, creates browser notifications
  - browser.alarms.create call in handleEvaluate for L3 tier candidates
  - onInstalled/onStartup badge refresh listeners in defineBackground

affects:
  - 05-02 (subsequent scheduling plans)
  - popup UI (badge reflects pending L3 follow-ups)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD (RED/GREEN) for alarm/notification/badge logic
    - Export alarm handler as named function for unit testability (not relying on defineBackground callback execution)
    - Global beforeEach browser.action mocks for all tests that call refreshBadge indirectly

key-files:
  created: []
  modified:
    - linkedin-hhrh-screener/entrypoints/background.ts
    - linkedin-hhrh-screener/tests/background.test.ts

key-decisions:
  - "handleAlarm exported as named function: defineBackground callback is NOT executed on import in Vitest (defineBackground returns { main: fn } without calling fn), so alarm handler must be exported for direct unit testability"
  - "Global browser.action mocks in beforeEach: handleEvaluate and handleSaveMessage now call refreshBadge() internally; global mock prevents 'not implemented' errors in existing tests without modifying each test"
  - "vi.restoreAllMocks() added to afterEach: prevents spy accumulation across describe blocks when describe-level spies wrap already-mocked globals"
  - "refreshBadge() called after saveCandidate in handleEvaluate (not just for L3): badge always reflects current state after any evaluation"

patterns-established:
  - "Export alarm/event handlers as named functions when defineBackground callback won't run in test environment"
  - "Global beforeEach mock pattern: mock browser APIs not implemented by fake-browser at file scope so all tests inherit the mock"

requirements-completed: [SCHED-01, SCHED-02, SCHED-03]

# Metrics
duration: 10min
completed: 2026-03-11
---

# Phase 5 Plan 01: Scheduling and Notifications Summary

**browser.alarms-based L3 follow-up scheduling with badge counter via TDD — alarm fires browser notifications 7 days after evaluation, badge shows overdue L3 count**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-11T14:00:40Z
- **Completed:** 2026-03-11T14:10:00Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 2

## Accomplishments

- SCHED-01: `handleEvaluate()` creates `l3-followup-{id}` alarm with `when` = contactAfter timestamp for L3 candidates
- SCHED-02: `handleAlarm()` exported as named function; fires browser notification naming the candidate when alarm triggers (skips if already contacted)
- SCHED-03: `refreshBadge()` counts overdue uncontacted L3 candidates, sets badge text and red background color; clears badge when count is 0
- `handleSaveMessage()` calls `refreshBadge()` so badge decrements immediately after marking a candidate as contacted
- `defineBackground` registers `onAlarm`, `onInstalled`, `onStartup` listeners synchronously before `onMessage`
- All 124 tests pass (28 background + 96 across other test files)

## Task Commits

1. **Task 1: Write failing tests for SCHED-01, SCHED-02, SCHED-03 (RED)** - `aadcaa3` (test)
2. **Task 2: Implement refreshBadge, alarm creation, alarm handler (GREEN)** - `c427c03` (feat)

## Files Created/Modified

- `linkedin-hhrh-screener/entrypoints/background.ts` - Added `refreshBadge()` export, `handleAlarm()` export, alarm creation in `handleEvaluate`, badge refresh in `handleSaveMessage`, and alarm/startup listeners in `defineBackground`
- `linkedin-hhrh-screener/tests/background.test.ts` - Added 10 new tests across SCHED-01/02/03 describe blocks; added `handleAlarm` import; added global `browser.action` mocks to `beforeEach`; added `vi.restoreAllMocks()` to `afterEach`

## Decisions Made

- **handleAlarm exported as named function**: WXT's `defineBackground` does not execute the callback on module import (it returns `{ main: fn }`). The alarm handler had to be exported separately so tests can call it directly. The `defineBackground` body still registers `browser.alarms.onAlarm.addListener(handleAlarm)` for production use.
- **Global browser.action mocks**: Since `handleEvaluate` and `handleSaveMessage` now internally call `refreshBadge()`, and `fake-browser` does not implement `browser.action`, the global `beforeEach` was updated to mock `setBadgeText` and `setBadgeBackgroundColor` for all tests. This prevents breaking existing tests without requiring each test to set up mocks.
- **refreshBadge() called for all handleEvaluate outcomes**: Badge is refreshed after every evaluation (not just L3) to keep badge state consistent if a previous L3 was just counted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] handleAlarm exported as named function instead of inline closure**
- **Found during:** Task 2 (GREEN implementation)
- **Issue:** `defineBackground` in WXT does not execute its callback when imported in Vitest. `browser.alarms.onAlarm.trigger()` therefore calls no handlers, so SCHED-02 tests for notification creation always failed.
- **Fix:** Extracted the alarm handler body into an exported `handleAlarm()` function. `defineBackground` registers it via `browser.alarms.onAlarm.addListener(handleAlarm)`. Tests call `handleAlarm()` directly.
- **Files modified:** `linkedin-hhrh-screener/entrypoints/background.ts`, `linkedin-hhrh-screener/tests/background.test.ts`
- **Verification:** All 3 SCHED-02 tests pass with direct `handleAlarm()` calls
- **Committed in:** `c427c03` (Task 2 commit)

**2. [Rule 1 - Bug] Global browser.action mocks added to beforeEach to prevent existing test breakage**
- **Found during:** Task 2 (GREEN implementation) — after adding `refreshBadge()` call to `handleEvaluate` and `handleSaveMessage`
- **Issue:** Existing `handleEvaluate` and `handleSaveMessage` tests started throwing "Browser.action.setBadgeText not implemented" because `refreshBadge()` now runs as part of those functions
- **Fix:** Added `vi.spyOn(browser.action, 'setBadgeText').mockResolvedValue(undefined)` and `vi.spyOn(browser.action, 'setBadgeBackgroundColor').mockResolvedValue(undefined)` to the file-level `beforeEach`. Added `vi.restoreAllMocks()` to `afterEach` to prevent spy accumulation.
- **Files modified:** `linkedin-hhrh-screener/tests/background.test.ts`
- **Verification:** All 21 previously-passing tests continue to pass
- **Committed in:** `c427c03` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs — discovered during GREEN phase)
**Impact on plan:** Both fixes necessary for correct test isolation and implementation verifiability. No scope creep.

## Issues Encountered

- `fakeBrowser.alarms.onAlarm.trigger()` was the plan's suggested approach for SCHED-02 tests, but it only calls listeners registered on `fakeBrowser.alarms.onAlarm`, which requires `defineBackground` callback to run (it doesn't in tests). Resolved by exporting `handleAlarm` directly.

## Next Phase Readiness

- SCHED-01, SCHED-02, SCHED-03 requirements satisfied with passing tests
- `refreshBadge()` is exported and tested — ready to be wired into popup UI or other triggers in subsequent plans
- `handleAlarm()` exported pattern establishes the testability convention for any future alarm handlers

---
*Phase: 05-scheduling-and-notifications*
*Completed: 2026-03-11*

## Self-Check: PASSED

- FOUND: `.planning/phases/05-scheduling-and-notifications/05-01-SUMMARY.md`
- FOUND: `linkedin-hhrh-screener/entrypoints/background.ts`
- FOUND: `linkedin-hhrh-screener/tests/background.test.ts`
- FOUND: commit `aadcaa3` (RED phase)
- FOUND: commit `c427c03` (GREEN phase)
