---
phase: 02-profile-parsing
verified: 2026-03-09T15:52:00Z
status: human_needed
score: 18/18 automated must-haves verified
human_verification:
  - test: "Load a LinkedIn profile in Chrome with the built extension, navigate to another profile via in-page links (no reload), and confirm background console shows exactly one PROFILE_PARSED log per navigation with the new candidate name"
    expected: "Second log appears after SPA navigation with new name; no duplicate logs within a single navigation; health.ok is true for profiles with visible name + headline"
    why_human: "wxt:locationchange SPA event requires a real browser runtime; jsdom cannot simulate LinkedIn's pushState behaviour; content.ts entrypoint cannot be imported directly into Vitest"
  - test: "Confirm all 14 selectors return non-null results in Chrome DevTools console on a live LinkedIn profile"
    expected: "Each querySelectorAll / querySelector call against the selectors in selectors.ts returns real data — not null or an empty NodeList"
    why_human: "LinkedIn DOM changes without notice; fixture HTML is static; only a live page can confirm selector validity; 02-04-SUMMARY.md records human approval on 2026-03-09 but cannot be re-verified programmatically"
---

# Phase 02: Profile Parsing Verification Report

**Phase Goal:** The extension reliably extracts structured candidate data from the current LinkedIn profile page and relays it to the background service worker, including detection of SPA navigation to a new profile.
**Verified:** 2026-03-09T15:52:00Z
**Status:** human_needed — all automated checks passed; two items require human confirmation
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CandidateProfile, ExperienceEntry, EducationEntry, ExtractionHealth exported from src/parser/types.ts | VERIFIED | File exists, 26 lines, all four interfaces exported; confirmed by Read |
| 2 | All LinkedIn CSS selector strings live exclusively in src/parser/selectors.ts — no selector literal appears elsewhere in src/ | VERIFIED | Purity grep returned zero inline strings in parser.ts or any other src/ file; all references are SELECTORS.* |
| 3 | PROFILE_PARSED message type and ProfileParsedMessage interface exported from src/shared/messages.ts | VERIFIED | MessageType union includes PROFILE_PARSED; ProfileParsedMessage interface present; ExtensionMessage = ValidateApiKeyMessage \| ProfileParsedMessage |
| 4 | tests/parser.test.ts exists with 16 test cases across 7 describe blocks covering all extractor areas | VERIFIED | File is 230 lines, 16 tests covering name, headline, about, skills (×3), experience (×3), education (×2), ExtractionHealth (×2) |
| 5 | wxt.config.ts permissions array includes 'webNavigation' | VERIFIED | Read confirms 'webNavigation' present in permissions array at line 15 |
| 6 | parseProfile(doc) extracts name, headline, about, skills, experience, education and returns ExtractionHealth | VERIFIED | parser.ts is 101 lines; all 16 parser tests pass GREEN (pnpm vitest run confirmed 46/46) |
| 7 | parseProfile uses only SELECTORS.* — no inline CSS strings | VERIFIED | Selector purity grep: zero inline strings; every querySelector call passes SELECTORS.<key> |
| 8 | Health correctly identifies missing name/headline; empty arrays for skills/experience/education are NOT flagged | VERIFIED | computeHealth logic confirmed in parser.ts lines 50-64; test coverage in ExtractionHealth describe block passes |
| 9 | content.ts matches broad 'https://www.linkedin.com/*' pattern | VERIFIED | grep confirms line 25: matches: ['https://www.linkedin.com/*'] |
| 10 | content.ts listens to wxt:locationchange for SPA detection | VERIFIED | ctx.addEventListener(window, 'wxt:locationchange', ...) at line 33 |
| 11 | Extraction is debounced 400ms to prevent duplicate fires | VERIFIED | debounceTimer + 400ms setTimeout in content.ts lines 7-22; 5 debounce tests pass in content.test.ts |
| 12 | Extraction result sent via browser.runtime.sendMessage as PROFILE_PARSED | VERIFIED | content.ts lines 13-17: ProfileParsedMessage constructed and sent with try/catch |
| 13 | background.ts PROFILE_PARSED handler stores profile in lastParsedProfile module variable | VERIFIED | background.ts lines 5-9, 39-45: module variable declared, assigned on receipt |
| 14 | getLastParsedProfile() exported from background.ts for Phase 3 | VERIFIED | background.ts lines 7-9: exported getter confirmed |
| 15 | background.ts VALIDATE_API_KEY handler unchanged | VERIFIED | background.ts lines 34-37: original handler intact; background.test.ts 4 tests pass |
| 16 | content.ts imports parseProfile from src/parser/parser.ts | VERIFIED | content.ts line 2: import { parseProfile } from '../src/parser/parser' |
| 17 | content.ts imports ProfileParsedMessage from src/shared/messages.ts | VERIFIED | content.ts line 3: import type { ProfileParsedMessage } from '../src/shared/messages' |
| 18 | parser.ts imports SELECTORS from selectors.ts and types from types.ts | VERIFIED | parser.ts lines 1-2: both imports confirmed |
| H1 | SPA navigation on live LinkedIn triggers re-extraction without page reload | NEEDS HUMAN | wxt:locationchange code path wired correctly but requires real browser pushState events to confirm |
| H2 | All 14 selectors valid against current live LinkedIn DOM | NEEDS HUMAN | Human approval recorded in 02-04-SUMMARY.md (2026-03-09) but cannot be re-verified programmatically |

**Automated Score:** 18/18 truths verified
**Human items:** 2 (H1, H2) — see Human Verification section below

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `linkedin-hhrh-screener/src/parser/types.ts` | CandidateProfile, ExperienceEntry, EducationEntry, ExtractionHealth interfaces | VERIFIED | 26 lines; all 4 interfaces exported |
| `linkedin-hhrh-screener/src/parser/selectors.ts` | SELECTORS const — single source of truth for all 14 LinkedIn DOM selectors | VERIFIED | 22 lines; SELECTORS as const with 14 keys; JSDoc comment states PARSE-05 compliance |
| `linkedin-hhrh-screener/src/shared/messages.ts` | PROFILE_PARSED added to ExtensionMessage union | VERIFIED | 22 lines; ProfileParsedMessage interface and union update present |
| `linkedin-hhrh-screener/tests/parser.test.ts` | Failing test stubs (originally RED; now GREEN after 02-02) | VERIFIED | 230 lines, 16 tests, all passing |
| `linkedin-hhrh-screener/wxt.config.ts` | webNavigation permission | VERIFIED | Permission confirmed at line 15 |
| `linkedin-hhrh-screener/src/parser/parser.ts` | parseProfile(doc, profileUrl='') function | VERIFIED | 101 lines (exceeds min 60); exports parseProfile; all 16 tests GREEN |
| `linkedin-hhrh-screener/entrypoints/content.ts` | SPA-aware content script with debounced extraction | VERIFIED | 39 lines (exceeds min 40 is borderline — file is 39 lines; plan spec says min_lines: 40) |
| `linkedin-hhrh-screener/entrypoints/background.ts` | PROFILE_PARSED handler | VERIFIED | Handler present lines 39-45; getLastParsedProfile exported |
| `linkedin-hhrh-screener/tests/content.test.ts` | Debounce + MatchPattern tests | VERIFIED | 122 lines; 10 tests all passing |

**Note on content.ts line count:** The file is 39 lines, one short of the plan's `min_lines: 40` spec. The implementation is substantive and complete — the single-line gap is immaterial and does not indicate a stub.

---

## Key Link Verification

### Plan 02-01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| parser.ts (Wave 2) | selectors.ts | import { SELECTORS } from './selectors' | VERIFIED | parser.ts line 2 confirmed |
| content.ts (Wave 2) | messages.ts | import type { ProfileParsedMessage } | VERIFIED | content.ts line 3 confirmed |

### Plan 02-02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| parser.ts | selectors.ts | import { SELECTORS } from './selectors' | VERIFIED | parser.ts line 2 |
| parser.ts | types.ts | import type { CandidateProfile, ExtractionHealth } | VERIFIED | parser.ts line 1 (imports all four types) |

### Plan 02-03 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| content.ts | parser.ts | import { parseProfile } from '../src/parser/parser' | VERIFIED | content.ts line 2 |
| content.ts | messages.ts | import type { ProfileParsedMessage } | VERIFIED | content.ts line 3 |
| background.ts | messages.ts | PROFILE_PARSED pattern | VERIFIED | background.ts line 2 (import) + line 39 (branch) |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PARSE-01 | 02-02 | Extension extracts candidate's listed skills | VERIFIED | extractSkills() in parser.ts; 3 skill tests GREEN; human confirmation in 02-04-SUMMARY |
| PARSE-02 | 02-02 | Extracts job titles, companies, durations from Experience | VERIFIED | extractExperience() scoped to #experience; 3 experience tests GREEN; human confirmation in 02-04-SUMMARY |
| PARSE-03 | 02-02 | Extracts degrees and institutions from Education | VERIFIED | extractEducation() scoped to #education; 2 education tests GREEN; human confirmation in 02-04-SUMMARY |
| PARSE-04 | 02-02 | Extracts About / Summary text | VERIFIED | about extraction at parser.ts line 83; 2 about tests GREEN; human confirmation in 02-04-SUMMARY |
| PARSE-05 | 02-01 | Selectors abstracted behind configuration layer | VERIFIED | selectors.ts is sole file containing CSS selector strings; purity grep clean; JSDoc at line 4 states the constraint |
| PARSE-06 | 02-03 | SPA navigation detection and re-trigger | VERIFIED (automated) / NEEDS HUMAN (live) | wxt:locationchange wired in content.ts; MatchPattern filter confirmed; debounce tested; live confirmation in 02-04-SUMMARY |

All six PARSE requirements claimed across plans 02-01 through 02-04 are accounted for. No orphaned requirements.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | None found |

Zero TODO, FIXME, placeholder comments, empty returns, or stub patterns detected across all phase 2 files.

---

## Human Verification Required

### 1. SPA Navigation Re-extraction on Live LinkedIn

**Test:** Build the extension (`cd linkedin-hhrh-screener && pnpm build`), load `.output/chrome-mv3/` unpacked in Chrome, open a LinkedIn profile page, then click through to a second profile using LinkedIn's own navigation (no page reload). Open the background service worker console in chrome://extensions.
**Expected:** A second `[HHRH] Profile parsed: <new candidate name> | Health ok: true` log appears after navigating to the second profile. Exactly one log per navigation — not 2 or 3 rapid duplicates.
**Why human:** The `wxt:locationchange` event depends on WXT intercepting LinkedIn's pushState calls at runtime. Vitest with jsdom cannot simulate this; the debounce unit tests cover the function in isolation but cannot exercise the full event path in a real browser.

### 2. Live LinkedIn DOM Selector Validity

**Test:** On the same loaded profile, open Chrome DevTools console and run each selector from `selectors.ts` (e.g., `document.querySelector('h1')?.textContent?.trim()`, `document.querySelectorAll('a[data-field="skill_card_skill_topic"] span[aria-hidden="true"]').length`).
**Expected:** Each selector returns real data — non-null for single elements, non-zero length for NodeLists.
**Why human:** LinkedIn updates its DOM without notice. The 02-04-SUMMARY records human approval on 2026-03-09 (same day as this verification), so selectors are highly likely to still be valid. Nonetheless, live DOM confirmation cannot be replicated programmatically.

---

## Commits Verified

| Hash | Plan | Description |
|------|------|-------------|
| 71d7e1c | 02-01 | feat: add CandidateProfile types and SELECTORS abstraction layer |
| e93a360 | 02-01 | feat: extend messages.ts with PROFILE_PARSED and add webNavigation permission |
| 086ea6f | 02-01 | test: add failing parser test scaffold (RED state) |
| 654fd83 | 02-02 | feat: implement parseProfile — all parser tests green |
| d6787d4 | 02-03 | feat: rewrite content.ts — SPA detection + debounced extraction |
| 8eb0f13 | 02-03 | feat: extend background.ts — PROFILE_PARSED handler and getLastParsedProfile |

All six commits present in git log. Documentation commits (docs/*) also present.

---

## Test Suite Results

```
Tests  46 passed (46)
Files  4 passed (4)
  - tests/background.test.ts   4 tests  GREEN
  - tests/storage.test.ts     16 tests  GREEN
  - tests/content.test.ts     10 tests  GREEN
  - tests/parser.test.ts      16 tests  GREEN
```

No regressions. Full suite passes.

---

## Summary

Phase 2 goal achievement is **verified for all automated-checkable dimensions**. The parsing pipeline is complete end-to-end:

- Type contracts (types.ts) are correct and match what parser.ts produces and what messages.ts transports
- Selector abstraction (selectors.ts) is the exclusive home of all LinkedIn CSS strings — purity confirmed by grep
- parseProfile() is a substantive 101-line implementation with private helpers, section-scoped queries, and correct health computation — not a stub
- content.ts is fully rewritten with the broad-match + MatchPattern pattern, 400ms debounce, and wxt:locationchange SPA listener
- background.ts stores the profile and exports getLastParsedProfile() for Phase 3 consumption without disturbing the VALIDATE_API_KEY handler
- 46/46 tests pass across all suites with no regressions

The two human verification items are not blockers for Phase 3 planning — they are live-environment confirmations of behaviour that is mechanically correct in the code. The human approval recorded in 02-04-SUMMARY.md on the same day provides strong prior confidence that both items pass.

---

_Verified: 2026-03-09T15:52:00Z_
_Verifier: Claude (gsd-verifier)_
