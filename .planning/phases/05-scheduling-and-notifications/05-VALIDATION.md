---
phase: 5
slug: scheduling-and-notifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | linkedin-hhrh-screener/vitest.config.ts |
| **Quick run command** | `cd linkedin-hhrh-screener && npx vitest run tests/background.test.ts` |
| **Full suite command** | `cd linkedin-hhrh-screener && npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd linkedin-hhrh-screener && npx vitest run tests/background.test.ts`
- **After every plan wave:** Run `cd linkedin-hhrh-screener && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | SCHED-01 | unit | `npx vitest run tests/background.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | SCHED-02 | unit | `npx vitest run tests/background.test.ts` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | SCHED-03 | unit | `npx vitest run tests/background.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 2 | SCHED-04 | unit | `npx vitest run tests/popup.test.ts` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | SCHED-03 | integration | `npx vitest run` | ✅ exists | ⬜ pending |
| 05-03-01 | 03 | 3 | SCHED-01–04 | manual | Chrome extension end-to-end | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `linkedin-hhrh-screener/tests/background.test.ts` — add describe blocks for alarm creation (SCHED-01), alarm fire + notification (SCHED-02), badge refresh (SCHED-03)
- [ ] `linkedin-hhrh-screener/tests/popup.test.ts` — new test file with stubs for renderOverdueL3 (SCHED-04)

*Note: fake-browser v1.3.4 already implements `alarms.create`, `alarms.getAll`, `onAlarm.trigger`, `notifications.create`. Only `browser.action.setBadgeText` needs `vi.spyOn`.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| System notification appears when alarm fires | SCHED-02 | `fake-browser` triggers alarm but OS notification display cannot be automated | Load extension in Chrome, use DevTools > Application > Service Workers to trigger alarm manually, verify OS notification appears |
| Badge count updates after evaluating L3 candidate | SCHED-03 | Extension icon badge requires live Chrome environment | Evaluate an L3 candidate, verify badge shows count; mark as sent, verify badge decrements |
| Overdue L3 list appears in popup | SCHED-04 | Popup rendering requires Chrome extension context | Open popup after alarm fires, verify overdue section lists the candidate |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
