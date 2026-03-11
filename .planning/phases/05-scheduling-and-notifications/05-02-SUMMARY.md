---
phase: 05-scheduling-and-notifications
plan: 02
subsystem: ui
tags: [chrome-extension, wxt, popup, dom, typescript]

# Dependency graph
requires:
  - phase: 03-scoring-pipeline
    provides: getAllCandidates() function already imported in popup index.ts
  - phase: 05-scheduling-and-notifications plan 01
    provides: contactAfter field set on L3 candidates during evaluation
provides:
  - Popup overdue section HTML (#overdue-section, #overdue-list) in entrypoints/popup/index.html
  - renderOverdueL3() function in entrypoints/popup/index.ts filtering L3 candidates whose contact window has opened
affects:
  - 05-scheduling-and-notifications plan 03 (human checkpoint will visually verify this section renders correctly)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "renderOverdueL3() follows same pattern as renderCandidateList() — getElementById + getAllCandidates() + DOM mutation"

key-files:
  created: []
  modified:
    - linkedin-hhrh-screener/entrypoints/popup/index.html
    - linkedin-hhrh-screener/entrypoints/popup/index.ts

key-decisions:
  - "renderOverdueL3() placed immediately before showResult() in index.ts, after renderCandidateList() definition"
  - "No new imports needed — getAllCandidates already imported from storage module"
  - "Pre-existing TypeScript errors in content.ts, parser.ts, cortex.ts, and background.test.ts are out-of-scope (SCHED-01/02/03 work from plan 05-01)"

patterns-established:
  - "Popup fallback pattern: overdue section renders on every popup open without requiring alarm or notification permission"

requirements-completed: [SCHED-04]

# Metrics
duration: 2min
completed: 2026-03-11
---

# Phase 5 Plan 02: L3 Follow-ups Due popup section

**Popup overdue section rendering L3 candidates past their 7-day contact window via renderOverdueL3() — notification-denied fallback using existing getAllCandidates() call**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-11T14:00:39Z
- **Completed:** 2026-03-11T14:02:26Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `<section id="overdue-section">` with `<div id="overdue-list">` to popup HTML, positioned before #history-section
- Implemented `renderOverdueL3()` async function filtering L3 candidates where `contactAfter <= now` and `!messageSentAt`
- Connected `renderOverdueL3()` to popup load lifecycle alongside existing `renderStorageUsage()` and `renderCandidateList()` calls
- Empty-state message "No L3 candidates awaiting contact" renders when no candidates are overdue

## Task Commits

Each task was committed atomically:

1. **Task 1: Add #overdue-section to popup HTML** - `2c2f538` (feat)
2. **Task 2: Add renderOverdueL3() to popup index.ts** - `416e0e7` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified
- `linkedin-hhrh-screener/entrypoints/popup/index.html` - Added #overdue-section with #overdue-list child, before #history-section
- `linkedin-hhrh-screener/entrypoints/popup/index.ts` - Added renderOverdueL3() function and call at module load

## Decisions Made
- No new imports needed — `getAllCandidates` was already imported from `../../src/storage/storage`
- Popup DOM testing follows Phase 3/4 precedent: WXT popup context not wired to Vitest JSDOM environment; TypeScript compile + grep serve as automated gate; functional verification deferred to Plan 05-03 human checkpoint

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript compilation errors in `content.ts`, `parser.ts`, `cortex.ts`, and `background.test.ts` (all SCHED-01/02/03 scope from plan 05-01). These errors are unrelated to this plan's changes and were present before execution. Verified by git diff — none of those files were modified by this plan. Test suite has 7 pre-existing failures in `background.test.ts` for the same reason; all 117 other tests pass with no regressions.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 05-02 complete: popup has overdue section HTML and rendering logic
- Plan 05-03 (human checkpoint) will visually verify the overdue section appears correctly in Chrome with real candidate data
- Plans 05-01 (alarm/badge background service) still needs GREEN implementation — pre-existing test failures show the alarm and badge code is not yet exported from background.ts

---
*Phase: 05-scheduling-and-notifications*
*Completed: 2026-03-11*
