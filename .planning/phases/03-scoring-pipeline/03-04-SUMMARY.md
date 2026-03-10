---
phase: 03-scoring-pipeline
plan: "04"
subsystem: database
tags: [storage, browser-storage, candidate, crud, tdd, vitest]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: storage.ts JD CRUD pattern (saveJd/getAllJds/deleteJd), schema.ts with CandidateRecord and STORAGE_KEYS.candidate

provides:
  - saveCandidate(record: CandidateRecord) — persists to candidate:{id}, updates CANDIDATE_INDEX
  - getAllCandidates() — returns all candidates sorted newest-first by evaluatedAt
  - deleteCandidate(id) — removes record and index entry

affects:
  - 03-scoring-pipeline (scorer writes evaluated candidates via saveCandidate)
  - 04-popup-ui (list view reads via getAllCandidates)
  - 05-outreach (reads/updates candidate records)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - getCandidateIndex() private helper — eliminates 3x duplication of CANDIDATE_INDEX read (mirrors getJdIndex pattern exactly)
    - getAllCandidates sorts by evaluatedAt descending using String.localeCompare

key-files:
  created: []
  modified:
    - linkedin-hhrh-screener/src/storage/storage.ts
    - linkedin-hhrh-screener/tests/storage.test.ts

key-decisions:
  - "saveCandidate mirrors saveJd exactly: index update only if id absent, then record write — avoids duplicate index entries on re-save"
  - "getAllCandidates sort uses b.evaluatedAt.localeCompare(a.evaluatedAt) — ISO 8601 strings sort lexicographically, no Date parsing needed"
  - "deleteCandidate does not check for existence before removing: filter is a no-op on missing id, browser.storage.local.remove on absent key is safe"

patterns-established:
  - "Private index helper pattern: getCandidateIndex() private, exported CRUD functions use it — consistent with JD helpers"
  - "TDD workflow: RED commit with failing tests, GREEN commit with minimal implementation, all 23 tests pass"

requirements-completed:
  - STORE-01
  - STORE-02
  - STORE-03

# Metrics
duration: 5min
completed: 2026-03-10
---

# Phase 3 Plan 4: Candidate Storage CRUD Summary

**Three typed browser.storage.local helpers — saveCandidate, getAllCandidates, deleteCandidate — mirroring the existing JD storage pattern, with getAllCandidates returning records sorted newest-first by evaluatedAt**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-10T13:19:33Z
- **Completed:** 2026-03-10T13:21:00Z
- **Tasks:** 2 (TDD: 1 RED + 1 GREEN)
- **Files modified:** 2

## Accomplishments

- Added 8 candidate CRUD tests covering persist, dedup, empty state, multi-record list, newest-first sort, delete, and no-throw on nonexistent id
- Implemented getCandidateIndex(), saveCandidate(), getAllCandidates(), deleteCandidate() following existing JD pattern exactly
- All 23 storage tests GREEN (15 pre-existing JD/API key + 8 new candidate tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add candidate CRUD tests (RED)** - `b8fde2b` (test)
2. **Task 2: Implement candidate CRUD in storage.ts (GREEN)** - `e0d053b` (feat)

_Note: TDD tasks — RED commit with failing tests, GREEN commit with passing implementation_

## Files Created/Modified

- `linkedin-hhrh-screener/src/storage/storage.ts` - Added CandidateRecord import, getCandidateIndex helper, saveCandidate, getAllCandidates, deleteCandidate exports
- `linkedin-hhrh-screener/tests/storage.test.ts` - Added saveCandidate/getAllCandidates/deleteCandidate imports, CandidateRecord type import, makeCandidate factory, 8 candidate CRUD test cases

## Decisions Made

- `getAllCandidates` sort uses `b.evaluatedAt.localeCompare(a.evaluatedAt)` — ISO 8601 strings sort lexicographically without Date parsing, matching the pattern recommended in the plan
- `deleteCandidate` issues no guard check for missing id — filter on a missing id is a no-op; `browser.storage.local.remove` on an absent key does not throw (verified by "no-throw on nonexistent" test)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `saveCandidate`, `getAllCandidates`, `deleteCandidate` are ready for use by the scoring pipeline (03-01/03-02/03-03) and popup UI (Phase 4)
- STORE-01, STORE-02, STORE-03 requirements fully covered

---
*Phase: 03-scoring-pipeline*
*Completed: 2026-03-10*
