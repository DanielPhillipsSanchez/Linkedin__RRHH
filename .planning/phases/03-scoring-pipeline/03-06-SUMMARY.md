---
phase: 03-scoring-pipeline
plan: 06
subsystem: popup-ui
tags: [popup, evaluate-button, result-display, candidate-history, storage-usage]
dependency_graph:
  requires: [03-05]
  provides: [EVALUATE-popup-UI, candidate-history-display, storage-usage-display]
  affects: [end-to-end-verification]
tech_stack:
  added: []
  patterns: [browser-runtime-sendMessage, async-dom-update, conditional-hidden-section]
key_files:
  created: []
  modified:
    - linkedin-hhrh-screener/entrypoints/popup/index.html
    - linkedin-hhrh-screener/entrypoints/popup/index.ts
    - linkedin-hhrh-screener/entrypoints/popup/style.css
decisions:
  - "Popup uses index.html + index.ts (existing WXT entrypoint) — main.ts is the unused WXT scaffold, index.ts is the real popup"
  - "Storage link included in HTML via stylesheet link tag — CSS in style.css not main.ts (WXT loads separate files correctly)"
  - "result-section uses HTML hidden attribute — toggled by showResult(); avoids flash of empty content on popup open"
metrics:
  duration_minutes: 2
  completed_date: "2026-03-10"
  tasks_completed: 1
  files_modified: 3
---

# Phase 03 Plan 06: Evaluate Popup UI Summary

**One-liner:** Minimal Evaluate popup with button, tier/score/skills/rationale result display, candidate history list, and storage usage — wired to background EVALUATE handler via browser.runtime.sendMessage.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Build minimal Evaluate popup UI | f3963db | entrypoints/popup/index.html, index.ts, style.css |

## Checkpoint Pending

Task 2 is `type="checkpoint:human-verify"` — awaiting human end-to-end verification on a live LinkedIn profile.

## Decisions Made

1. **index.ts is the real popup entry (not main.ts):** The WXT project scaffold created `index.html` pointing at `index.ts` for the popup. `main.ts` is the unused WXT default template. All popup logic was placed in `index.ts` to match the existing entrypoint convention.

2. **result-section starts hidden:** `hidden` attribute on `#result-section` prevents rendering an empty result panel on popup open. Toggled by `showResult()` on first evaluation result.

3. **EvaluateResult import is type-only:** `import type { EvaluateResult }` avoids bundling the messages module — only the TypeScript interface is needed at the popup layer.

## What Was Built

### index.html
- Header with title and Settings link
- `#evaluate-section` with `#evaluate-btn`
- `#result-section` (hidden by default) with tier, score, matched/missing skills, rationale, error message
- `#storage-section` with `#storage-usage`
- `#history-section` with `#candidate-list`

### index.ts
- Settings link → `browser.runtime.openOptionsPage()`
- `renderStorageUsage()` — calls `getStorageUsageBytes()` and `STORAGE_QUOTA_BYTES`; displays "X KB / 10 MB" or "unavailable" if 0
- `renderCandidateList()` — calls `getAllCandidates()`, renders each as `{name} — {tierLabel} — {score}% — {date}`
- `showResult(result)` — populates result section; handles error field first; colour-codes tier via data-tier attribute
- Evaluate button click handler — disables button, sends `{ type: 'EVALUATE' }` message, calls `showResult`, re-renders history, re-enables button
- Initialises storage usage and candidate list on popup open

### style.css
- Minimal functional layout (340px wide popup)
- Tier colour coding: L1=green, L2=blue, L3=amber, rejected=red
- Responsive button states (loading = muted blue)
- Candidate list items truncated with text-overflow

## Test Results

```
Test Files  5 passed (5)
     Tests  80 passed (80)
  Duration  627ms
```

All existing tests GREEN — popup code has no unit tests (DOM-heavy; UI verified via human checkpoint).

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- entrypoints/popup/index.html: FOUND
- entrypoints/popup/index.ts: FOUND
- entrypoints/popup/style.css: FOUND
- Commit f3963db: FOUND
- Build output popup.html + popup-*.js: FOUND
- All 80 tests GREEN
