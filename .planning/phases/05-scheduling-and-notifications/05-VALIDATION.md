---
phase: 5
slug: scheduling-and-notifications
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-10
nyquist_justification: |
  SCHED-04 (renderOverdueL3 popup rendering) is designated manual-only. The WXT popup
  entrypoint runs in a Chrome extension context. This project's Vitest environment targets
  background service worker logic via @webext-core/fake-browser and has no JSDOM/happy-dom
  setup for popup DOM testing. The same decision was applied to popup tests in Phases 3 and 4.
  The automated gate for SCHED-04 tasks is TypeScript compilation (npx tsc --noEmit), which
  catches type errors in renderOverdueL3(); functional verification is covered by the Plan 05-03
  human checkpoint. This satisfies Nyquist intent: every requirement has either an automated
  test or an explicit manual-only designation with documented justification.
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
| 05-01-01 | 01 | 1 | SCHED-01 | unit | `npx vitest run tests/background.test.ts` | ✅ Wave 0 in 05-01 | ⬜ pending |
| 05-01-02 | 01 | 1 | SCHED-02 | unit | `npx vitest run tests/background.test.ts` | ✅ Wave 0 in 05-01 | ⬜ pending |
| 05-01-03 | 01 | 1 | SCHED-03 | unit | `npx vitest run tests/background.test.ts` | ✅ Wave 0 in 05-01 | ⬜ pending |
| 05-02-01 | 02 | 1 | SCHED-04 | manual-only | `npx tsc --noEmit` (compile gate) + Plan 05-03 checkpoint | N/A — see justification | ⬜ pending |
| 05-02-02 | 02 | 1 | SCHED-04 | manual-only | `npx tsc --noEmit` (compile gate) + Plan 05-03 checkpoint | N/A — see justification | ⬜ pending |
| 05-03-01 | 03 | 2 | SCHED-01–04 | manual | Chrome extension end-to-end | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `linkedin-hhrh-screener/tests/background.test.ts` — add describe blocks for alarm creation (SCHED-01), alarm fire + notification (SCHED-02), badge refresh (SCHED-03). Handled inside Plan 05-01 Task 1 (RED step).
- [x] SCHED-04 popup rendering — designated manual-only per Phase 3/4 precedent (see `nyquist_justification` above). TypeScript compilation serves as the automated compile gate.

*Note: fake-browser v1.3.4 already implements `alarms.create`, `alarms.getAll`, `onAlarm.trigger`, `notifications.create`. Only `browser.action.setBadgeText` needs `vi.spyOn`.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| System notification appears when alarm fires | SCHED-02 | `fake-browser` triggers alarm but OS notification display cannot be automated | Load extension in Chrome, use DevTools > Application > Service Workers to trigger alarm manually, verify OS notification appears |
| Badge count updates after evaluating L3 candidate | SCHED-03 | Extension icon badge requires live Chrome environment | Evaluate an L3 candidate, verify badge shows count; mark as sent, verify badge decrements |
| Overdue L3 list appears in popup | SCHED-04 | Popup rendering requires Chrome extension context; no JSDOM/happy-dom in Vitest setup (Phase 3/4 precedent) | Open popup after alarm fires, verify overdue section lists the candidate |
| Popup empty state shows correct message | SCHED-04 | Same as above | Open popup with no overdue L3s, verify "No L3 candidates awaiting contact" text |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or explicit manual-only designation with justification
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (SCHED-01/02/03 all have unit tests; SCHED-04 has compile gate + human checkpoint)
- [x] Wave 0 covers all MISSING references (background.test.ts describe blocks in 05-01; popup designated manual-only)
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
