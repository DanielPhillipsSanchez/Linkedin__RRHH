---
phase: 02-profile-parsing
plan: 03
subsystem: content-script
tags: [typescript, vitest, wxt, spa-navigation, debounce, content-script, background]

# Dependency graph
requires:
  - phase: 02-01
    provides: ProfileParsedMessage interface, CandidateProfile/ExtractionHealth types
  - phase: 02-02
    provides: parseProfile() function in src/parser/parser.ts
provides:
  - SPA-aware content script with 400ms debounced extraction trigger
  - PROFILE_PARSED message handler in background.ts with module-level profile store
  - getLastParsedProfile() export for Phase 3 AI scoring consumption
affects:
  - 03-ai-scoring (reads lastParsedProfile via getLastParsedProfile())

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Broad match + internal MatchPattern check: matches 'https://www.linkedin.com/*' at the WXT level, filter /in/* URLs internally via MatchPattern to survive SPA navigation"
    - "wxt:locationchange event listener via ctx.addEventListener for SPA detection without polling"
    - "400ms debounce on extraction to collapse multiple rapid pushState events into one PROFILE_PARSED message"
    - "sendMessage wrapped in try/catch to prevent content script crash when background service worker restarts"
    - "Module-level profile store in background.ts: lastParsedProfile variable + getter for inter-phase data sharing"

key-files:
  created:
    - linkedin-hhrh-screener/tests/content.test.ts
  modified:
    - linkedin-hhrh-screener/entrypoints/content.ts
    - linkedin-hhrh-screener/entrypoints/background.ts

key-decisions:
  - "wxt/utils/match-patterns instead of wxt/sandbox: wxt/sandbox specifier does not exist in the installed WXT version; wxt/utils/match-patterns re-exports @webext-core/match-patterns with identical MatchPattern API"
  - "Debounce applied to both initial and SPA navigation triggers: runExtraction() uses the same 400ms debounce regardless of trigger source for consistent deduplication"
  - "sendResponse({ received: true }) for PROFILE_PARSED: content script awaits sendMessage; responding avoids port-kept-open warning without blocking the background"

requirements-completed:
  - PARSE-06

# Metrics
duration: 3min
completed: 2026-03-09
---

# Phase 02 Plan 03: SPA-Aware Content Script and PROFILE_PARSED Handler Summary

**SPA detection via wxt:locationchange + 400ms debounce wired to parseProfile, with PROFILE_PARSED storage in background.ts for Phase 3 consumption**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-09T20:29:24Z
- **Completed:** 2026-03-09T20:31:44Z
- **Tasks:** 2
- **Files modified:** 3 (content.ts, background.ts, new content.test.ts)

## Accomplishments

- Rewrote entrypoints/content.ts from a 7-line scaffold to a 40-line SPA-aware script: broad matches pattern + internal MatchPattern check, wxt:locationchange listener, 400ms debounced extraction, sendMessage with try/catch
- Extended entrypoints/background.ts: module-level lastParsedProfile store, getLastParsedProfile() getter, PROFILE_PARSED branch in onMessage listener — VALIDATE_API_KEY handler unchanged
- Created tests/content.test.ts with 10 tests: 5 MatchPattern URL filtering tests + 5 debounce behaviour tests using vi.useFakeTimers()
- All 46 tests across 4 suites pass (storage, background, content, parser)
- PARSE-06 requirement satisfied: SPA navigation to a new /in/ profile URL triggers extraction without page reload

## Task Commits

Each task was committed atomically:

1. **Task 1: content.ts rewrite + tests (TDD GREEN)** - `d6787d4` (feat)
2. **Task 2: background.ts PROFILE_PARSED handler** - `8eb0f13` (feat)

## Files Created/Modified

- `linkedin-hhrh-screener/entrypoints/content.ts` - Rewritten: broad matches, MatchPattern filter, 400ms debounced runExtraction, wxt:locationchange SPA listener
- `linkedin-hhrh-screener/entrypoints/background.ts` - Extended: lastParsedProfile module variable, getLastParsedProfile() getter, PROFILE_PARSED branch
- `linkedin-hhrh-screener/tests/content.test.ts` - Created: 10 tests covering MatchPattern URL filtering and debounce deduplication

## Decisions Made

- Used `wxt/utils/match-patterns` instead of `wxt/sandbox`: the research doc specifies `wxt/sandbox` but this specifier does not exist in the WXT version installed (0.20.x). `wxt/utils/match-patterns` is a valid export path that re-exports `@webext-core/match-patterns` with identical MatchPattern API.
- Tests test the debounce function in isolation (not the WXT entrypoint): `defineContentScript` requires a browser runtime that vitest cannot provide. The debounce helper is extracted as a pure function (`makeDebounced`) and tested directly, covering all observable behaviours.
- PROFILE_PARSED handler responds synchronously: `sendResponse({ received: true })` is called immediately; `return true` keeps the port open. This avoids "message port closed" warnings in the console.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] wxt/sandbox specifier not found in installed WXT version**
- **Found during:** Task 1 (RED test run)
- **Issue:** `import { MatchPattern } from 'wxt/sandbox'` caused "Missing './sandbox' specifier in 'wxt' package" error. The plan and WXT research doc reference `wxt/sandbox`, but this export does not exist in the installed WXT 0.20.x package.
- **Fix:** Changed import to `wxt/utils/match-patterns` which is a valid export path re-exporting `@webext-core/match-patterns`. Applied the same correction in both tests/content.test.ts and entrypoints/content.ts.
- **Files modified:** tests/content.test.ts, entrypoints/content.ts
- **Verification:** `pnpm vitest run tests/content.test.ts` — 10 tests pass
- **Committed in:** `d6787d4` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No functional or architectural impact. MatchPattern API is identical regardless of import path. The `wxt/utils/match-patterns` path is the correct canonical path for this WXT version.

## Issues Encountered

None beyond the wxt/sandbox auto-fix above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 3 (AI scoring) can call `getLastParsedProfile()` from background.ts to read the most recent parsed profile
- The PROFILE_PARSED message flow is complete: content script parses → sends message → background stores
- The content script will correctly fire on every /in/* profile whether reached by direct URL or SPA navigation

---
*Phase: 02-profile-parsing*
*Completed: 2026-03-09*
