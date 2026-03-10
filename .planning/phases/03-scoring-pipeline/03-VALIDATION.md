---
phase: 3
slug: scoring-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `linkedin-hhrh-screener/vitest.config.ts` |
| **Quick run command** | `cd linkedin-hhrh-screener && npx vitest run tests/scorer.test.ts tests/storage.test.ts` |
| **Full suite command** | `cd linkedin-hhrh-screener && npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd linkedin-hhrh-screener && npx vitest run tests/scorer.test.ts tests/storage.test.ts`
- **After every plan wave:** Run `cd linkedin-hhrh-screener && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 0 | SCORE-01, SCORE-03, SCORE-04, SCORE-06, SCORE-07, SCORE-08 | unit | `npx vitest run tests/scorer.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | SCORE-01 | unit | `npx vitest run tests/scorer.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | SCORE-03 | unit | `npx vitest run tests/scorer.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 1 | SCORE-04, SCORE-06, SCORE-07 | unit | `npx vitest run tests/scorer.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 1 | SCORE-02, SCORE-08 | unit | `npx vitest run tests/scorer.test.ts` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 1 | STORE-01, STORE-02, STORE-03 | unit | `npx vitest run tests/storage.test.ts` | ✅ (extend) | ⬜ pending |
| 03-05-01 | 05 | 2 | SCORE-05 | unit | `npx vitest run tests/background.test.ts` | ✅ (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/scorer.test.ts` — failing stubs for SCORE-01, SCORE-03, SCORE-04, SCORE-06, SCORE-07, SCORE-08
- [ ] `src/scorer/scorer.ts` — skeleton file (empty exports)
- [ ] `src/scorer/tiers.ts` — skeleton file (empty exports)
- [ ] `src/scorer/claude.ts` — skeleton file (empty exports)

*Wave 0 must be committed before Wave 1 implementation begins.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Evaluate on real LinkedIn profile → tier label + score within 30s | SCORE-05 (E2E) | Requires live Claude API + real LinkedIn DOM | Load extension in Chrome, open a LinkedIn profile, click Evaluate, verify tier + score appear within 30s |
| Claude rationale text is meaningful (not empty/truncated) | SCORE-08 (E2E) | Requires live Claude API response | Same as above — inspect rationale text in popup |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
