---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-06
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^3 via WXT Vitest plugin |
| **Config file** | `vitest.config.ts` — Wave 0 creates this |
| **Quick run command** | `pnpm vitest run tests/storage.test.ts` |
| **Full suite command** | `pnpm vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run tests/storage.test.ts`
- **After every plan wave:** Run `pnpm vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green + manual checklist complete
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | SET-01–06 | infra | `pnpm vitest run` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | SET-01 | unit | `pnpm vitest run tests/storage.test.ts -t "saveApiKey"` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | SET-02 | unit | `pnpm vitest run tests/background.test.ts -t "validateStoredApiKey"` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | SET-03 | unit | `pnpm vitest run tests/storage.test.ts -t "saveJd"` | ❌ W0 | ⬜ pending |
| 1-01-05 | 01 | 1 | SET-03 | unit | `pnpm vitest run tests/storage.test.ts -t "getAllJds"` | ❌ W0 | ⬜ pending |
| 1-01-06 | 01 | 1 | SET-04 | unit | `pnpm vitest run tests/storage.test.ts -t "saveJd rawText"` | ❌ W0 | ⬜ pending |
| 1-01-07 | 01 | 1 | SET-05 | unit | `pnpm vitest run tests/storage.test.ts -t "skill weight"` | ❌ W0 | ⬜ pending |
| 1-01-08 | 01 | 1 | SET-06 | unit | `pnpm vitest run tests/storage.test.ts -t "activeJdId"` | ❌ W0 | ⬜ pending |
| 1-01-09 | 01 | 1 | SET-06 | unit | `pnpm vitest run tests/storage.test.ts -t "deleteJd clears active"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — WXT Vitest plugin setup with `@webext-core/fake-browser`
- [ ] `pnpm add -D vitest @webext-core/fake-browser` — if not bundled by WXT after init
- [ ] `tests/storage.test.ts` — stubs for SET-01, SET-03, SET-04, SET-05, SET-06
- [ ] `tests/background.test.ts` — stubs for SET-02 background validation handler

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Extension loads in Chrome developer mode without errors | SET-01 | Requires browser environment | Load unpacked from `.output/chrome-mv3/`; open options page; no console errors |
| Options page form submits API key and shows validation status | SET-01, SET-02 | Browser UI interaction | Enter key; click Save; confirm "validated" status shown; confirm input cleared |
| API key never appears in content script context | SET-02 | Code review | `grep -r "getApiKey\|apiKey\|settings:apiKey" entrypoints/content.ts` → 0 results |
| JD create/edit/delete works in options page UI | SET-03, SET-04 | Browser UI | Create 3 JDs; edit one; delete one; confirm list updates correctly |
| Skill weighting radio buttons save correctly | SET-05 | Browser UI | Add skills; toggle mandatory/nice-to-have; reload options page; confirm weights persisted |
| Active JD selection persists across page reload | SET-06 | Browser UI | Select JD; reload options page; confirm selection retained |
| Extension loads in Safari developer mode | SET-01 | Requires Xcode + Safari | Build via Xcode; enable in Safari developer settings; open options page; no errors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
