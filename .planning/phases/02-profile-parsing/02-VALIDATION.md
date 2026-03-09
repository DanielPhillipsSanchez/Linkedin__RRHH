---
phase: 2
slug: profile-parsing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | `linkedin-hhrh-screener/vitest.config.ts` |
| **Quick run command** | `pnpm vitest run` |
| **Full suite command** | `pnpm vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run`
- **After every plan wave:** Run `pnpm vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 2-01-01 | 01 | 1 | PARSE-05 | unit | `pnpm vitest run tests/parser.test.ts` | ⬜ pending |
| 2-01-02 | 01 | 1 | PARSE-01 | unit | `pnpm vitest run tests/parser.test.ts` | ⬜ pending |
| 2-01-03 | 01 | 1 | PARSE-02 | unit | `pnpm vitest run tests/parser.test.ts` | ⬜ pending |
| 2-01-04 | 01 | 1 | PARSE-03 | unit | `pnpm vitest run tests/parser.test.ts` | ⬜ pending |
| 2-01-05 | 01 | 1 | PARSE-04 | unit | `pnpm vitest run tests/parser.test.ts` | ⬜ pending |
| 2-02-01 | 02 | 2 | PARSE-06 | unit | `pnpm vitest run tests/content.test.ts` | ⬜ pending |
| 2-02-02 | 02 | 2 | PARSE-06 | manual | Open LinkedIn, navigate between profiles | ⬜ pending |
| 2-03-01 | 03 | 3 | PARSE-01..04 | manual | Load real profile, inspect health report | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/parser.test.ts` — stubs for PARSE-01 through PARSE-05 (selectors, skills, experience, education, about)
- [ ] `tests/content.test.ts` — stubs for PARSE-06 (SPA navigation detection)

*Existing Vitest infrastructure covers all other phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SPA navigation re-triggers parsing on real LinkedIn | PARSE-06 | Requires real LinkedIn DOM + browser runtime | Open LinkedIn profile, navigate to second profile in same tab, confirm extension re-extracts |
| Health report surfaces partial fields | PARSE-03 (health) | Requires real profile with missing sections | Open profile with no About section, verify health report shows field as missing |
| Skills "Show all" partial result | PARSE-01 | Skills lazy-load; programmatic click not implemented | Verify parser returns 3-5 initial skills, health report notes partial |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
