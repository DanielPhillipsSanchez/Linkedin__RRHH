---
plan: 01-06
phase: 01-foundation
status: partial
completed: 2026-03-09
---

# Plan 01-06 Summary: Safari Xcode Project Setup

## What Was Built

Safari WXT build pipeline verified working. Xcode project creation deferred — requires full Xcode app installation.

## Key Files

### No new files committed
- `wxt.config.ts` — unchanged from Plan 01-01 (no Safari-specific config needed for the build target)

## Commits
- None (Task 1 verified but no config changes needed; Task 2 blocked by missing Xcode)

## Verification Results

### Task 1: Safari Build
- `pnpm wxt build -b safari` — ✓ exits 0, produces `.output/safari-mv2/` (WXT uses MV2 for Safari — correct behavior)
- `.output/safari-mv2/manifest.json` — ✓ exists
- `.output/safari-mv2/` is in `.gitignore` — expected, not committed

### Task 2: Xcode Project — BLOCKED
- `xcrun safari-web-extension-converter` requires full **Xcode.app** installation
- Only **Xcode Command Line Tools** are installed (`xcode-select -p` → `/Library/Developer/CommandLineTools`)
- `wxt-module-safari-xcode@0.1.0` also wraps `xcrun safari-web-extension-converter` — same blocker

## Deviation: Xcode Project Deferred

**Impact on Phase 6:** Minimal. The Safari build pipeline itself works. Phase 6 (Safari finalization) requires Xcode anyway. The only risk is that Phase 6 begins with a `xcrun safari-web-extension-converter` step before any Safari-specific UI work.

**Resolution:** Install full Xcode.app from the App Store, then run:
```bash
pnpm wxt build -b safari
xcrun safari-web-extension-converter .output/safari-mv2 \
  --project-location ./safari-extension \
  --app-name "LinkedIn HHRH Screener" \
  --bundle-identifier com.linkedin-hhrh.screener \
  --swift \
  --force
git add safari-extension/
git commit -m "chore: add Safari Xcode project scaffold"
```

This can be done at any point before Phase 6 begins.

## Self-Check: PARTIAL
