---
phase: 04-output-layer
plan: "04"
subsystem: api
tags: [anthropic, storage, background-service, options-ui, typescript]

# Dependency graph
requires:
  - phase: 04-output-layer
    provides: "04-02 committed Cortex migration; 04-03 human verification of output layer"
provides:
  - "All Snowflake/Cortex runtime references removed from production code paths"
  - "background.ts exclusively uses getAnthropicApiKey() + validateAnthropicApiKey()"
  - "claude.ts refineWithClaude() calls anthropicComplete(apiKey: string, ...)"
  - "messenger.ts generateOutreachMessage() takes apiKey: string, calls anthropicComplete()"
  - "Options page shows only Anthropic API key section (no Snowflake fields)"
  - "wxt.config.ts host_permissions: linkedin.com + api.anthropic.com only"
affects: [04-05, 05-notifications, 06-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "All AI calls route through anthropicComplete(apiKey: string, prompt: string)"
    - "VALIDATE_API_KEY handler validates against stored Anthropic key (no Snowflake path)"
    - "Single credential type: ANTHROPIC_API_KEY string — no CortexCredentials object"

key-files:
  created: []
  modified:
    - linkedin-hhrh-screener/src/storage/schema.ts
    - linkedin-hhrh-screener/src/storage/storage.ts
    - linkedin-hhrh-screener/src/scorer/claude.ts
    - linkedin-hhrh-screener/src/scorer/messenger.ts
    - linkedin-hhrh-screener/entrypoints/background.ts
    - linkedin-hhrh-screener/entrypoints/options/index.ts
    - linkedin-hhrh-screener/entrypoints/options/index.html
    - linkedin-hhrh-screener/wxt.config.ts

key-decisions:
  - "[04-04]: Cortex migration from 04-02 fully reversed — all production paths use direct Anthropic API calls"
  - "[04-04]: cortex.ts retained as unreachable dead code — no imports exist outside the file itself"
  - "[04-04]: VALIDATE_API_KEY message type consolidates both credential validation paths (no VALIDATE_CLAUDE_API_KEY handler)"

patterns-established:
  - "Options page sends VALIDATE_API_KEY (not payload-bearing VALIDATE_CLAUDE_API_KEY) — background reads from storage"

requirements-completed: [MSG-01, MSG-02, MSG-03, MSG-04, MSG-05, MSG-06, CSV-01, CSV-02, CSV-03, CSV-04, CSV-05]

# Metrics
duration: 5min
completed: 2026-03-10
---

# Phase 04 Plan 04: Cortex-to-Anthropic Reversion Summary

**All Snowflake Cortex runtime paths removed — scorer, messenger, background, and options UI exclusively use direct Anthropic API calls with a single string API key**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-10T21:05:50Z
- **Completed:** 2026-03-10T21:10:00Z
- **Tasks:** 2 verified (changes already applied in prior session commits)
- **Files modified:** 8

## Accomplishments
- Verified schema.ts has `ANTHROPIC_API_KEY` only — no SF_* keys remain
- Verified storage.ts exports `saveAnthropicApiKey`/`getAnthropicApiKey` — no Snowflake types or functions
- Verified claude.ts `refineWithClaude(apiKey: string, ...)` calls `anthropicComplete` (no cortex path)
- Verified messenger.ts `generateOutreachMessage(apiKey: string, ...)` calls `anthropicComplete`
- Verified background.ts imports `getAnthropicApiKey` + `validateAnthropicApiKey` exclusively
- Verified options HTML has single Claude API key section — no Snowflake form fields
- Verified wxt.config.ts `host_permissions` contains only `linkedin.com` and `api.anthropic.com`
- Verified grep of production files returns zero Cortex/Snowflake references outside cortex.ts itself

## Task Commits

The plan's changes were applied across prior session commits and verified as complete:

1. **Task 1: Update schema.ts and storage.ts** - `ef048cf` (feat: replace Snowflake keys with ANTHROPIC_API_KEY in schema and storage)
2. **Task 2: Update claude.ts, messenger.ts, background.ts, wxt.config.ts, and options UI** - `922d086` (chore: commit working-tree changes — 107 tests pass, wxt build clean)

**Plan metadata:** (this SUMMARY.md commit)

## Files Created/Modified
- `src/storage/schema.ts` - `ANTHROPIC_API_KEY` only; `SF_*` and deprecated `API_KEY` keys removed; `Settings` interface removed
- `src/storage/storage.ts` - `saveAnthropicApiKey`/`getAnthropicApiKey`/`isApiKeyBuiltIn`; Snowflake types and helpers removed
- `src/scorer/claude.ts` - `refineWithClaude(apiKey: string, ...)` using `anthropicComplete`; no cortex import
- `src/scorer/messenger.ts` - `generateOutreachMessage(apiKey: string, ...)` using `anthropicComplete`; no cortex import
- `entrypoints/background.ts` - All handlers use `getAnthropicApiKey()`; `validateStoredCredentials` calls `validateAnthropicApiKey`
- `entrypoints/options/index.ts` - Imports from Anthropic storage helpers only; no Snowflake refs
- `entrypoints/options/index.html` - Single Claude API key section; no Snowflake form fields
- `linkedin-hhrh-screener/wxt.config.ts` - `host_permissions`: only `linkedin.com` + `api.anthropic.com`

## Decisions Made
- cortex.ts retained as unreachable dead code — it has no importers; removing it is safe but not required
- VALIDATE_API_KEY message type is the single validation path — background reads key from storage, does not accept key in message payload (SET-02 pattern maintained)

## Deviations from Plan

None — plan executed exactly as written. All changes were already committed in prior session (commit `ef048cf` and `922d086`). This execution confirmed all plan success criteria are met via TypeScript audit and grep verification.

## Issues Encountered
- `src/scorer/cortex.ts` produces TypeScript errors (`chrome` not defined) — this is expected dead code with no importers. The plan explicitly noted cortex.ts is "unused dead code but not harmful to leave." These errors are pre-existing and out of scope.
- `entrypoints/content.ts` and `src/parser/parser.ts` have pre-existing TypeScript errors unrelated to this plan's changes.

## User Setup Required
None — no external service configuration required. Anthropic API key is entered via the Options page at runtime.

## Next Phase Readiness
- All Cortex runtime paths removed; only Anthropic API path remains
- 04-05 (if it exists) can proceed: any remaining cleanup or gap closure in the output layer
- Phase 05 notifications layer has clean credential interface: `getAnthropicApiKey()` returns `string | undefined`

---
*Phase: 04-output-layer*
*Completed: 2026-03-10*
