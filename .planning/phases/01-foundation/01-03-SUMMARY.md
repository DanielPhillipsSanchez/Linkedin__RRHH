---
phase: 01-foundation
plan: 03
subsystem: api
tags: [background-service-worker, message-passing, anthropic-api, fetch-mock, vitest, tdd]

requires:
  - phase: 01-01
    provides: tests/background.test.ts with 4 todo stubs; src/shared/messages.ts with VALIDATE_API_KEY types; WXT defineBackground global
  - phase: 01-02
    provides: src/storage/storage.ts with getApiKey() function
provides:
  - entrypoints/background.ts with exported validateStoredApiKey() and onMessage listener
  - 4 passing unit tests for VALIDATE_API_KEY handler covering all response paths
  - SET-02 compliance — API key read only in background context, never in message payload
affects: [01-04, 01-05]

tech-stack:
  added: []
  patterns:
    - validateStoredApiKey exported as named function for direct unit testing (not buried in defineBackground callback)
    - vi.stubGlobal('fetch', vi.fn()) for fetch mocking in Vitest — no msw needed
    - onMessage returns true before async operation to keep Chrome message channel open
    - API key never appears in any response payload — only {valid, error?} returned

key-files:
  created: []
  modified:
    - linkedin-hhrh-screener/entrypoints/background.ts
    - linkedin-hhrh-screener/tests/background.test.ts

key-decisions:
  - "validateStoredApiKey exported as named export for unit testability — not just called within defineBackground"
  - "fetch mocked via vi.stubGlobal (not vi.mock or msw) — simplest approach, confirmed working in Vitest 4.0.18"
  - "No inline getApiKey workaround needed — storage.ts (Plan 02) was completed before Plan 03 executed"
  - "return true placed at end of VALIDATE_API_KEY branch, before any other message types fall through"

patterns-established:
  - "Pattern 1: Named export for testable async background functions — export async function validateStoredApiKey()"
  - "Pattern 2: fetch mock with vi.stubGlobal('fetch', vi.fn()) + vi.unstubAllGlobals() in afterEach"
  - "Pattern 3: onMessage returns true synchronously to keep Chrome message channel open for async sendResponse"

requirements-completed: [SET-01, SET-02]

duration: 5min
completed: 2026-03-09
---

# Phase 1 Plan 03: Background VALIDATE_API_KEY Handler Summary

**Background service worker with exported validateStoredApiKey() fetching Anthropic /v1/models endpoint — API key reads only in background context, all 4 unit tests passing via vi.stubGlobal fetch mock**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-09T08:33:45Z
- **Completed:** 2026-03-09T08:35:00Z
- **Tasks:** 2 (RED + GREEN)
- **Files modified:** 2

## Accomplishments
- `validateStoredApiKey()` exported as named function — directly unit testable without browser runtime
- All 4 behavior paths tested: no key stored, 200 OK, 401 Unauthorized, network error (fetch throws)
- `return true` in onMessage listener keeps Chrome MV3 message channel open for async `sendResponse`
- API key never appears in response — only `{ valid: boolean; error?: string }` returned to callers
- Full test suite: 20/20 tests pass (16 storage + 4 background)

## Task Commits

1. **RED phase: failing background tests** - `2eea1a0` (test)
2. **GREEN phase: background.ts implementation** - `1578a7a` (feat)

## Files Created/Modified
- `linkedin-hhrh-screener/entrypoints/background.ts` - validateStoredApiKey() + onMessage listener with VALIDATE_API_KEY handler
- `linkedin-hhrh-screener/tests/background.test.ts` - 4 unit tests using vi.stubGlobal('fetch') + fakeBrowser storage

## Decisions Made
- **fetch mocked via `vi.stubGlobal`:** Plan specified `vi.stubGlobal('fetch', vi.fn())` — confirmed working cleanly in Vitest 4.0.18. No msw or other library needed.
- **Named export for testability:** `validateStoredApiKey` exported at module level (not buried in defineBackground callback) so tests can import and call it directly.
- **No inline getApiKey workaround:** Plan 02 (storage helpers) was completed before Plan 03 executed, so the import from `../src/storage/storage` worked without the inline fallback described in the plan.
- **`return true` placement:** Placed inside the `if (message.type === 'VALIDATE_API_KEY')` branch — listener returns `undefined` for unhandled message types, which is correct.

## Deviations from Plan

None — plan executed exactly as written. The inline getApiKey workaround was not needed since Plan 02 was available. fetch mocked with vi.stubGlobal as specified.

## Issues Encountered
None.

## User Setup Required
None.

## Next Phase Readiness
- Plan 04 (Options Page UI) can send `{ type: 'VALIDATE_API_KEY' }` via `browser.runtime.sendMessage()` and receive `{ valid, error? }` response
- The background handler is live and tested — options page wires to it without changes needed here
- Plans 02 and 03 complete Wave 1; Wave 2 (Plan 04) can begin

## Self-Check: PASSED

- [x] `linkedin-hhrh-screener/entrypoints/background.ts` — FOUND
- [x] `linkedin-hhrh-screener/tests/background.test.ts` — FOUND
- [x] Commit `2eea1a0` (RED phase) — FOUND
- [x] Commit `1578a7a` (GREEN phase) — FOUND
- [x] `.planning/phases/01-foundation/01-03-SUMMARY.md` — FOUND
- [x] `pnpm vitest run` — 20/20 tests pass (4 background + 16 storage)

---
*Phase: 01-foundation*
*Completed: 2026-03-09*
