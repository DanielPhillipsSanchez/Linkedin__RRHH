---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Completed 05-01-PLAN.md — SCHED-01/02/03 alarm scheduling and badge refresh
last_updated: "2026-03-11T21:47:28.651Z"
last_activity: 2026-03-06 — Roadmap created, all 41 v1 requirements mapped to 6 phases
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 25
  completed_plans: 25
  percent: 14
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-06)

**Core value:** A recruiter can open any LinkedIn profile and know within seconds whether to pursue the candidate, which tier they fall into, and have a ready-to-send personalized message — all in one click.
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 5 (Foundation)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-03-06 — Roadmap created, all 41 v1 requirements mapped to 6 phases

Progress: [█░░░░░░░░░] 14%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01-foundation P01 | 4 | 2 tasks | 12 files |
| Phase 01-foundation P03 | 5 | 2 tasks | 2 files |
| Phase 01-foundation P02 | 12 | 3 tasks | 2 files |
| Phase 02-profile-parsing P01 | 15 | 3 tasks | 7 files |
| Phase 02-profile-parsing P02 | 125 | 1 tasks | 1 files |
| Phase 02-profile-parsing P03 | 3 | 2 tasks | 3 files |
| Phase 03-scoring-pipeline P04 | 5 | 2 tasks | 2 files |
| Phase 03-scoring-pipeline P01 | 5 | 1 tasks | 4 files |
| Phase 03-scoring-pipeline P02 | 8 | 2 tasks | 2 files |
| Phase 03-scoring-pipeline P03 | 8 | 1 tasks | 1 files |
| Phase 03-scoring-pipeline P05 | 10 | 2 tasks | 3 files |
| Phase 03-scoring-pipeline P06 | 2 | 1 tasks | 3 files |
| Phase 04-output-layer P01 | 2 | 2 tasks | 2 files |
| Phase 04-output-layer P02 | 8 | 2 tasks | 19 files |
| Phase 04-output-layer P03 | 5 | 2 tasks | 0 files |
| Phase 04-output-layer P04 | 5 | 2 tasks | 8 files |
| Phase 04-output-layer P05 | 10 | 2 tasks | 1 files |
| Phase 05-scheduling-and-notifications P02 | 2 | 2 tasks | 2 files |
| Phase 05-scheduling-and-notifications P01 | 6 | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Hybrid keyword + Claude scoring: keywords handle clear matches cheaply; Claude handles ambiguous skills and synonyms
- Chrome + Safari v1: both primary recruiter browsers; WebExtensions API overlap makes shared codebase feasible
- No backend for v1: CSV export sufficient for solo recruiters; eliminates infrastructure complexity
- Recruiter reviews before sending: auto-send explicitly excluded for compliance reasons
- Layer 3 = 7-day delay: L1/L2 candidates get first-mover advantage; enforced via chrome.alarms + badge
- [Phase 01-01]: webextension-polyfill not needed: WXT 0.20.18 bundles browser.* polyfill internally
- [Phase 01-01]: @types/chrome not needed: WXT generates chrome.* types in .wxt/types/ via wxt prepare
- [Phase 01-01]: vitest@4.0.18 and @webext-core/fake-browser@1.3.4 manually added as devDependencies (not pre-bundled)
- [Phase 01-foundation]: validateStoredApiKey exported as named function for direct unit testability without browser runtime
- [Phase 01-foundation]: fetch mocked via vi.stubGlobal in Vitest — no msw needed for background service worker tests
- [Phase 01-foundation]: API key never in message payload — background returns {valid, error?} only (SET-02 compliance)
- [Phase 01-foundation]: getJdIndex() private helper eliminates 3x duplication of JD index read pattern
- [Phase 01-foundation]: Explicit (result[KEY] as string[] | undefined) cast required for TypeScript strict mode with browser.storage.local.get return type
- [Phase 01-foundation]: getStorageUsageBytes guards getBytesInUse call — fake-browser does not implement it; returns 0 in test env
- [Phase 02-profile-parsing]: jsdom installed as devDependency: WxtVitest defaults to happy-dom which lacks DOMParser
- [Phase 02-profile-parsing]: SELECTORS abstraction layer (PARSE-05): all 14 LinkedIn CSS selector strings live exclusively in src/parser/selectors.ts
- [Phase 02-profile-parsing]: ExtractionHealth.missing excludes profileUrl: set by caller not extracted from DOM
- [Phase 02-profile-parsing]: health.ok depends only on name AND headline — name is critical signal; headline confirms real profile page (not error page)
- [Phase 02-profile-parsing]: skills/experience/education empty arrays not flagged as missing — sections may not be scrolled; absence is valid state
- [Phase 02-profile-parsing]: profileUrl defaults to empty string — content script passes window.location.href; default enables pure testability
- [Phase 02-profile-parsing]: wxt/utils/match-patterns instead of wxt/sandbox: wxt/sandbox specifier does not exist in the installed WXT version
- [Phase 02-profile-parsing]: Debounce applied to extraction trigger: 400ms debounce deduplicates multiple pushState events per LinkedIn SPA navigation
- [Phase 02-profile-parsing]: Module-level lastParsedProfile in background.ts: Phase 3 reads most recent profile via getLastParsedProfile() without additional message round-trip
- [Phase 03-scoring-pipeline]: getAllCandidates sorts by evaluatedAt descending using String.localeCompare — ISO 8601 strings sort correctly without Date parsing
- [Phase 03-scoring-pipeline]: getCandidateIndex private helper pattern mirrors getJdIndex — avoids duplicating CANDIDATE_INDEX read across three functions
- [Phase 03-01]: runKeywordPass returns Skill[] for unmatchedSkills so callers can filter by weight to derive mandatory-only missingSkills without extra lookup
- [Phase 03-01]: Tier boundary 70=L3: score >= 71 is L2, score >= 60 (and <= 70) is L3 — exact boundary documented in test cases
- [Phase 03-scoring-pipeline]: computeScore Set<string> uses verbatim JD skill text — normalisation only inside skillMatches, runKeywordPass pushes skill.text directly
- [Phase 03-scoring-pipeline]: runKeywordPass returns unmatchedSkills as Skill[] (all weights); SCORE-07 mandatory-only filter is caller's responsibility
- [Phase 03-scoring-pipeline]: Tier thresholds hardcoded (>=80 L1, >=71 L2, >=60 L3) — configurable thresholds deferred to v2
- [Phase 03-scoring-pipeline]: Direct fetch over @anthropic-ai/sdk in claude.ts: SDK may use Node.js globals incompatible with service worker; proven pattern from background.ts
- [Phase 03-scoring-pipeline]: Model pinned to claude-haiku-4-5-20251001 (not claude-3-haiku-20240307 which is deprecated April 2026)
- [Phase 03-scoring-pipeline]: JSON.parse failure in refineWithClaude returns graceful fallback instead of throwing — scoring degrades gracefully on unexpected Claude output
- [Phase 03-scoring-pipeline]: handleEvaluate exported as named function for direct unit testability — same pattern as validateStoredApiKey
- [Phase 03-scoring-pipeline]: _setLastParsedProfileForTest exported: fakeBrowser.sendMessage requires registered listeners; direct setter avoids message round-trip in tests
- [Phase 03-06]: Popup uses index.ts entrypoint (not main.ts): WXT scaffold created index.html→index.ts as real popup; main.ts is unused scaffold
- [Phase 03-06]: result-section starts hidden via HTML hidden attribute: prevents empty result panel flash on popup open
- [Phase 04-output-layer]: [04-01]: csv.test.ts already existed with 9 tests; added one missing empty-messageSentText test to satisfy MSG-06 coverage
- [Phase 04-output-layer]: [04-01]: baseCandidateRecord fixture placed at module scope to be shared across handleGenerateMessage and handleSaveMessage describe blocks
- [Phase 04-output-layer]: generate-msg-btn guarded by HTML disabled attribute AND JS showResult() toggle — belt-and-suspenders ensures correct initial and post-evaluate state
- [Phase 04-output-layer]: Cortex migration (Anthropic-to-Snowflake) uncommitted working-tree changes committed as 04-02 Task 1 — brings git history in sync with passing test suite
- [Phase 04-output-layer]: [04-03]: Human recruiter approved all 6 output-layer verification steps in Chrome — MSG-01 through MSG-06 and CSV-01 through CSV-05 confirmed working end-to-end
- [Phase 04-output-layer]: [04-04]: Cortex migration from 04-02 fully reversed — all production paths use direct Anthropic API calls; cortex.ts retained as unreachable dead code
- [Phase 04-output-layer]: [04-04]: VALIDATE_API_KEY message type is the single validation path — background reads key from storage, does not accept key in message payload (SET-02 pattern)
- [Phase 04-output-layer]: [04-05]: Test files already had Anthropic mocks applied — suite was green on first run; messenger.ts prompt wording refined for Colombian Spanish conciseness
- [Phase 04-output-layer]: [04-05]: Human recruiter approved all 7 verification steps — MSG-01 through MSG-06 and CSV-01 through CSV-05 confirmed working end-to-end with Anthropic Claude API key
- [Phase 05-02]: renderOverdueL3() placed immediately before showResult() in index.ts, after renderCandidateList() definition
- [Phase 05-02]: No new imports needed — getAllCandidates already imported from storage module
- [Phase 05-01]: handleAlarm exported as named function: defineBackground callback is NOT executed on import in Vitest (returns { main: fn } without calling fn), so alarm handler must be exported for direct unit testability
- [Phase 05-01]: Global browser.action mocks in beforeEach: handleEvaluate and handleSaveMessage now call refreshBadge() internally; global mock prevents 'not implemented' errors in existing tests without modifying each test

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 2: LinkedIn DOM selectors must be validated against live LinkedIn markup before writing extraction code — no documentation covers current structure
- Phase 3: Verify @anthropic-ai/sdk uses only fetch() with no Node.js globals before integrating in service worker
- Phase 3: Verify current Claude Haiku model ID at https://docs.anthropic.com/en/docs/about-claude/models before pinning
- Phase 5: Verify Safari 16+ browser.alarms persistence behavior against current Apple documentation before scheduling implementation

## Session Continuity

Last session: 2026-03-11T14:07:32.580Z
Stopped at: Completed 05-01-PLAN.md — SCHED-01/02/03 alarm scheduling and badge refresh
Resume file: None
