---
phase: 01-foundation
plan: 01
subsystem: infra
tags: [wxt, typescript, vitest, fake-browser, chrome-extension, webextension]

# Dependency graph
requires: []
provides:
  - WXT 0.20.18 project scaffold in linkedin-hhrh-screener/
  - wxt.config.ts with full manifest permissions, host_permissions, options_ui
  - src/storage/schema.ts with STORAGE_KEYS, Skill, JobDescription, Settings, CandidateRecord
  - src/shared/messages.ts with VALIDATE_API_KEY message types
  - vitest.config.ts with WxtVitest plugin and fake-browser integration
  - tests/storage.test.ts with 14 todo stubs for storage behaviors
  - tests/background.test.ts with 4 todo stubs for validateStoredApiKey
affects: [01-02, 01-03, 01-04, 01-05, all-subsequent-plans]

# Tech tracking
tech-stack:
  added:
    - wxt@0.20.18 (WXT browser extension framework)
    - typescript@5.9.3
    - vitest@4.0.18 (test runner)
    - "@webext-core/fake-browser@1.3.4" (in-memory browser.* API for tests)
  patterns:
    - STORAGE_KEYS constant object as single source of truth for all storage key strings
    - WxtVitest() plugin pattern for vitest integration with WXT fake browser environment
    - it.todo() pattern for test stubs that compile and run without failures

key-files:
  created:
    - linkedin-hhrh-screener/wxt.config.ts
    - linkedin-hhrh-screener/src/storage/schema.ts
    - linkedin-hhrh-screener/src/shared/messages.ts
    - linkedin-hhrh-screener/vitest.config.ts
    - linkedin-hhrh-screener/tests/storage.test.ts
    - linkedin-hhrh-screener/tests/background.test.ts
    - linkedin-hhrh-screener/entrypoints/background.ts
    - linkedin-hhrh-screener/entrypoints/content.ts
    - linkedin-hhrh-screener/entrypoints/popup/index.html
    - linkedin-hhrh-screener/entrypoints/popup/index.ts
    - linkedin-hhrh-screener/entrypoints/options/index.html
    - linkedin-hhrh-screener/entrypoints/options/index.ts
  modified: []

key-decisions:
  - "Project directory named linkedin-hhrh-screener (as specified in plan)"
  - "webextension-polyfill NOT manually added — WXT bundles browser.* polyfill internally"
  - "@types/chrome NOT needed — WXT generates chrome.* types in .wxt/types/ automatically"
  - "vitest@4.0.18 manually added (not pre-bundled with WXT); @webext-core/fake-browser@1.3.4 also added"
  - "popup/index.ts created alongside generated main.ts (main.ts kept for scaffold completeness)"

patterns-established:
  - "STORAGE_KEYS pattern: all storage key strings defined in src/storage/schema.ts, never hardcoded elsewhere"
  - "Test stub pattern: it.todo() creates compilable, runnable todo stubs — suite exits 0 with 18 todos skipped"
  - "WXT entry pattern: entrypoints use defineBackground/defineContentScript globals without explicit imports"

requirements-completed: [SET-01, SET-02, SET-03, SET-04, SET-05, SET-06]

# Metrics
duration: 4min
completed: 2026-03-09
---

# Phase 1 Plan 01: WXT Scaffold, Storage Schema, and Test Infrastructure Summary

**WXT 0.20.18 chrome-mv3 extension project with typed storage schema (STORAGE_KEYS, Skill, JobDescription, Settings, CandidateRecord), shared message types, and Vitest 4.0.18 + fake-browser test infrastructure with 18 todo stubs building green**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-09T13:27:16Z
- **Completed:** 2026-03-09T13:30:37Z
- **Tasks:** 2
- **Files modified:** 12 created

## Accomplishments

- Initialized WXT 0.20.18 project with vanilla TypeScript template in `linkedin-hhrh-screener/`
- Configured `wxt.config.ts` with all required manifest fields: 6 permissions, 2 host_permissions, options_ui
- Created `src/storage/schema.ts` with all 5 required exports: STORAGE_KEYS, Skill, JobDescription, Settings, CandidateRecord — single source of truth for all later plans
- Set up Vitest 4.0.18 with WxtVitest plugin and fake-browser; 18 todo stubs in 2 test files run green
- `pnpm wxt build`, `pnpm vitest run`, and `pnpm tsc --noEmit` all exit 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize WXT project and configure wxt.config.ts** - `8cef720` (feat)
2. **Task 2: Define storage schema types and create test scaffolds** - `806e0ad` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `linkedin-hhrh-screener/wxt.config.ts` - Full manifest config with permissions, host_permissions, options_ui
- `linkedin-hhrh-screener/src/storage/schema.ts` - STORAGE_KEYS constants + Skill, JobDescription, Settings, CandidateRecord types
- `linkedin-hhrh-screener/src/shared/messages.ts` - VALIDATE_API_KEY message types for background communication
- `linkedin-hhrh-screener/vitest.config.ts` - Vitest config with WxtVitest plugin for fake-browser environment
- `linkedin-hhrh-screener/tests/storage.test.ts` - 14 todo stubs covering all SET-0x storage behaviors
- `linkedin-hhrh-screener/tests/background.test.ts` - 4 todo stubs for validateStoredApiKey
- `linkedin-hhrh-screener/entrypoints/background.ts` - Service worker stub with HHRH console log
- `linkedin-hhrh-screener/entrypoints/content.ts` - Content script matching linkedin.com/in/* with scaffold comment
- `linkedin-hhrh-screener/entrypoints/popup/index.html` - Minimal popup with Settings link
- `linkedin-hhrh-screener/entrypoints/popup/index.ts` - openOptionsPage handler on settings link click

## Decisions Made

- **webextension-polyfill not added manually:** WXT provides its own `browser.*` polyfill internally; adding it would create a conflict. Confirmed by checking node_modules after init.
- **@types/chrome not added:** WXT generates comprehensive chrome.* types in `.wxt/types/` during `wxt prepare`; `pnpm tsc --noEmit` passes without @types/chrome.
- **vitest manually added:** WXT 0.20.18 does not pre-bundle vitest; both `vitest@4.0.18` and `@webext-core/fake-browser@1.3.4` were added as devDependencies.
- **popup/index.ts created alongside generated main.ts:** The template generates main.ts; we create index.ts as the plan specifies and reference it from index.html. Both files coexist harmlessly; main.ts is not imported.

## Deviations from Plan

None - plan executed exactly as written. WXT 0.20.18 handled all type generation automatically, eliminating the conditional steps for @types/chrome and webextension-polyfill.

## Issues Encountered

- `pnpm dlx wxt@latest init` required `--pm pnpm` flag to bypass interactive package manager prompt in non-TTY environment; resolved with flag addition.
- Prior execution session had partially created files; verified all files match plan specification before proceeding.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Storage schema locked: all Plans 02-07 can import from `src/storage/schema.ts`
- Test infrastructure ready: `pnpm vitest run` runs the full suite, stubs in storage.test.ts and background.test.ts awaiting TDD implementation in Plans 02 and 03
- Build pipeline verified: `pnpm wxt build` produces `.output/chrome-mv3/` with valid manifest
- TypeScript strict compilation verified: no errors across all source files

---
*Phase: 01-foundation*
*Completed: 2026-03-09*
