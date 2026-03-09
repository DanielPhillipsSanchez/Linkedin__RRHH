---
phase: 02-profile-parsing
plan: 01
subsystem: parser
tags: [typescript, vitest, jsdom, linkedin, dom-selectors, tdd]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: WXT project scaffold, TypeScript config, Vitest test infrastructure, shared messages.ts base
provides:
  - CandidateProfile, ExperienceEntry, EducationEntry, ExtractionHealth interfaces (src/parser/types.ts)
  - SELECTORS single-source-of-truth const object for all LinkedIn CSS selector strings (src/parser/selectors.ts)
  - PROFILE_PARSED message type and ProfileParsedMessage interface added to ExtensionMessage union
  - webNavigation permission added to wxt.config.ts
  - Failing test scaffold (RED state) covering name, headline, about, skills, experience, education, and ExtractionHealth
affects:
  - 02-02-parser-implementation (Wave 2 — implements parser.ts to turn RED tests GREEN)
  - 02-03-content-script (imports ProfileParsedMessage from messages.ts)
  - 03-ai-scoring (CandidateProfile shape is the input contract for scoring)

# Tech tracking
tech-stack:
  added:
    - jsdom 28.1.0 (vitest jsdom environment for DOM fixture tests)
    - "@types/jsdom 28.0.0 (TypeScript types for jsdom)"
  patterns:
    - Selector abstraction layer: all LinkedIn CSS strings live exclusively in selectors.ts (PARSE-05)
    - Document injection pattern: parseProfile(doc: Document) accepts Document for testability without browser
    - TDD RED scaffold: tests import from non-existent parser.ts to guarantee failure before Wave 2 implementation

key-files:
  created:
    - linkedin-hhrh-screener/src/parser/types.ts
    - linkedin-hhrh-screener/src/parser/selectors.ts
    - linkedin-hhrh-screener/tests/parser.test.ts
  modified:
    - linkedin-hhrh-screener/src/shared/messages.ts
    - linkedin-hhrh-screener/wxt.config.ts
    - linkedin-hhrh-screener/package.json
    - linkedin-hhrh-screener/pnpm-lock.yaml

key-decisions:
  - "jsdom installed as devDependency: WxtVitest defaults to happy-dom which lacks DOMParser; jsdom required for full DOM fixture test support"
  - "experienceItem and educationItem selector both set to 'li.artdeco-list__item': queries must be scoped to section element first to avoid cross-section contamination"
  - "ExtractionHealth.missing typed as Array<keyof Omit<CandidateProfile, 'profileUrl'>>: profileUrl is set by caller not extracted from DOM so excluded from missing-field tracking"
  - "skills treated as always-valid empty array: Skills section may be absent if not scrolled; empty array is valid state per PARSE-01"

patterns-established:
  - "Pattern: SELECTORS as const — import { SELECTORS } from './selectors', never inline selector strings in parser logic"
  - "Pattern: Section-scoped queries — doc.querySelector(SELECTORS.experienceSection) then .querySelectorAll() within result"
  - "Pattern: @vitest-environment jsdom header comment to override WxtVitest happy-dom default per test file"

requirements-completed:
  - PARSE-05

# Metrics
duration: 15min
completed: 2026-03-09
---

# Phase 02 Plan 01: Parser Contracts and Test Scaffold Summary

**TypeScript interface contracts for CandidateProfile + 14-selector SELECTORS abstraction layer + failing RED test scaffold across 6 extractor areas, with jsdom and PROFILE_PARSED message type wired in**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-09T15:22:00Z
- **Completed:** 2026-03-09T15:37:00Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Created src/parser/types.ts exporting CandidateProfile, ExperienceEntry, EducationEntry, ExtractionHealth — the input/output contracts Wave 2 implementation and Phase 3 scoring depend on
- Created src/parser/selectors.ts as the single source of truth for all 14 LinkedIn DOM selector strings (PARSE-05 satisfied)
- Extended messages.ts with ProfileParsedMessage and PROFILE_PARSED union member; added webNavigation permission to wxt.config.ts; tsc --noEmit passes clean
- Wrote tests/parser.test.ts with 13 test cases across 7 describe blocks (name, headline, about, skills, experience, education, ExtractionHealth) — all fail in RED state confirming Wave 2 implementation target
- Installed jsdom 28.1.0 to support @vitest-environment jsdom override (WxtVitest defaults to happy-dom which lacks DOMParser)
- Verified existing 20 tests (storage.test.ts + background.test.ts) remain green — no regression

## Task Commits

Each task was committed atomically:

1. **Task 1: CandidateProfile types and SELECTORS** - `71d7e1c` (feat)
2. **Task 2: messages.ts PROFILE_PARSED + wxt.config.ts webNavigation** - `e93a360` (feat)
3. **Task 3: Failing parser test scaffold (RED)** - `086ea6f` (test)

## Files Created/Modified
- `linkedin-hhrh-screener/src/parser/types.ts` - CandidateProfile, ExperienceEntry, EducationEntry, ExtractionHealth interfaces
- `linkedin-hhrh-screener/src/parser/selectors.ts` - SELECTORS const with 14 LinkedIn CSS selector strings
- `linkedin-hhrh-screener/src/shared/messages.ts` - Added ProfileParsedMessage and PROFILE_PARSED to ExtensionMessage union
- `linkedin-hhrh-screener/wxt.config.ts` - Added 'webNavigation' to permissions array
- `linkedin-hhrh-screener/tests/parser.test.ts` - 13 failing RED tests covering all 6 extractor areas + ExtractionHealth
- `linkedin-hhrh-screener/package.json` - Added jsdom 28.1.0 and @types/jsdom 28.0.0 as devDependencies
- `linkedin-hhrh-screener/pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- Installed jsdom instead of using happy-dom: WxtVitest plugin sets happy-dom as the default test environment, but DOMParser (used in fixture HTML creation) requires jsdom for full fidelity.
- ExtractionHealth.missing excludes profileUrl: profileUrl is injected by the caller (content script sets it to window.location.href), not extracted from DOM, so it should not appear in the missing-field health list.
- Both experienceItem and educationItem use 'li.artdeco-list__item': LinkedIn reuses design system classes across sections; Wave 2 parser must scope queries to the containing section element first.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed jsdom devDependency**
- **Found during:** Task 3 (writing failing parser tests)
- **Issue:** Running tests with `@vitest-environment jsdom` failed with "Cannot find package 'jsdom'" — jsdom was not installed
- **Fix:** Ran `pnpm add -D jsdom @types/jsdom`; tests now load the jsdom environment and fail correctly with the expected import error (RED confirmed)
- **Files modified:** package.json, pnpm-lock.yaml
- **Verification:** `pnpm vitest run tests/parser.test.ts` now fails with "Failed to resolve import ../src/parser/parser" (correct RED) instead of environment startup error
- **Committed in:** `086ea6f` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for RED state to be confirmed via import error rather than environment crash. No scope creep.

## Issues Encountered
None beyond the jsdom missing package auto-fix above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All contracts Wave 2 depends on are in place: CandidateProfile shape, SELECTORS, ProfileParsedMessage
- tests/parser.test.ts defines the exact behavior parseProfile() must implement — Wave 2 writes parser.ts to turn RED GREEN
- The 13 failing tests are the specification; Wave 2 plan (02-02) should import and turn them green without modifying the test file

---
*Phase: 02-profile-parsing*
*Completed: 2026-03-09*
