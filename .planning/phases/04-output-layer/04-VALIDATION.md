---
phase: 4
slug: output-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `linkedin-hhrh-screener/vitest.config.ts` |
| **Quick run command** | `cd linkedin-hhrh-screener && npx vitest run tests/messenger.test.ts tests/background.test.ts tests/csv.test.ts` |
| **Full suite command** | `cd linkedin-hhrh-screener && npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd linkedin-hhrh-screener && npx vitest run tests/messenger.test.ts tests/background.test.ts tests/csv.test.ts`
- **After every plan wave:** Run `cd linkedin-hhrh-screener && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 0 | MSG-06 | unit | `npx vitest run tests/background.test.ts` | ❌ W0 | ⬜ pending |
| 4-01-02 | 01 | 0 | MSG-06 | unit | `npx vitest run tests/background.test.ts` | ❌ W0 | ⬜ pending |
| 4-01-03 | 01 | 0 | CSV-02..CSV-05 | unit | `npx vitest run tests/csv.test.ts` | ❌ W0 | ⬜ pending |
| 4-02-01 | 02 | 1 | MSG-01..03 | unit | `npx vitest run tests/messenger.test.ts` | ✅ | ⬜ pending |
| 4-02-02 | 02 | 1 | MSG-04 | manual | popup test in Chrome | manual | ⬜ pending |
| 4-02-03 | 02 | 1 | MSG-05 | manual | Live LinkedIn tab test | manual | ⬜ pending |
| 4-02-04 | 02 | 1 | CSV-01 | manual | Export button in Chrome | manual | ⬜ pending |
| 4-03-01 | 03 | CP | Full flow | manual | End-to-end smoke test | manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/background.test.ts` — add `handleGenerateMessage` tests: happy path (mocked Cortex), candidate not found, rejected tier, no credentials
- [ ] `tests/background.test.ts` — add `handleSaveMessage` tests: saves `messageSentText` + `messageSentAt`, candidate not found
- [ ] `tests/csv.test.ts` — new file covering CSV-02 through CSV-05: column presence, L3 contactAfter, skills join format, RFC 4180 escaping

*Existing infrastructure (Vitest + @webext-core/fake-browser + vi.stubGlobal) covers all phase requirements. No new packages needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Recruiter edits message in textarea | MSG-04 | DOM interaction in popup | Load extension, evaluate profile, click Generate, edit textarea |
| LinkedIn compose window opens with candidate pre-filled | MSG-05 | External URL/live LinkedIn | Click "Open LinkedIn Message", verify compose opens and To: field has candidate |
| CSV download triggers file save | CSV-01 | browser.downloads / anchor-click in DOM | Click Export CSV, verify file saves with correct name |
| Full recruiter workflow end-to-end | All MSG+CSV | Sequence of UI steps | Evaluate → Generate → Edit → Open LinkedIn → Mark Sent → Export CSV |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
