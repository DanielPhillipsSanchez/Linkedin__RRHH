# Technology Stack

**Project:** LinkedIn HHRH Candidate Screener
**Researched:** 2026-03-06
**Confidence:** MEDIUM-HIGH (browser extension ecosystem well-established; versions verified against known 2025 releases)

---

## Recommended Stack

### Extension Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| WXT (Web Extension Tools) | ^0.19 | Cross-browser extension build framework | The dominant 2025 standard for Chrome + Firefox + Safari extensions. Replaces CRXJS and plain Vite configs. Handles MV3 manifest generation, HMR in development, entrypoint discovery, and Safari output preparation automatically. Single codebase targets Chrome and Safari without manual manifest duplication. |
| TypeScript | ^5.4 | Type-safe development | Standard for all extension code. WXT has first-class TS support. Catches API shape mismatches between chrome.* and browser.* polyfills early. |
| Vite | ^5.2 (via WXT) | Bundler / build pipeline | WXT uses Vite under the hood. Do not configure Vite separately — let WXT own it. Vite's ESM-first approach works cleanly with MV3 service workers. |

**Confidence:** MEDIUM — WXT is well-established as of mid-2024 and widely adopted; version numbers reflect late-2024/early-2025 releases. Verify latest WXT release at https://wxt.dev before pinning.

**Why not CRXJS:** CRXJS has stalled maintenance. WXT absorbed its ideas and is actively maintained.
**Why not plain webpack + manifest.json:** Requires manual cross-browser shim wiring, MV3 service worker configuration, and Safari adaptation — all solved by WXT.
**Why not Plasmo:** Plasmo is React-opinionated and adds significant bundle overhead. This project has no complex UI requirements that justify a full React dependency.

---

### UI Layer

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vanilla TypeScript (no framework) | n/a | Popup and options page HTML/CSS/JS | The extension popup is a simple panel: one job description selector, one candidate result view, one export button. No state management complexity justifies React or Vue. Vanilla TS keeps the bundle small and avoids Content Security Policy conflicts common with frameworks in extension contexts. |
| CSS (plain, scoped to shadow DOM where needed) | n/a | Styling popup and content script UI | Extensions inject into third-party pages; use a Shadow DOM boundary in the content script overlay to prevent LinkedIn's CSS from leaking in. |

**Confidence:** HIGH — shadow DOM isolation for content script UI is the established best practice for extensions injecting into complex third-party pages like LinkedIn.

**Why not React:** React in an extension popup works but adds ~40KB to the bundle, requires babel transform, and CSP configuration. For a panel with ~5 interactive elements, the overhead is not justified. Reconsider if the UI becomes complex (drag-and-drop JD management, multi-tab views).
**Why not Vue / Svelte:** Same reasoning. Svelte is lighter but still introduces a compiler dependency that WXT handles less cleanly than vanilla.

---

### AI Integration

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @anthropic-ai/sdk | ^0.24 | Official Anthropic Claude API client | The official SDK. Handles request serialization, streaming, and error types. Must be called from the background service worker (not content script) to keep the API key out of page context. |
| claude-haiku-3-5 (model) | latest | Skill matching and message generation | Haiku 3.5 is the correct model for this use case: fast, cheap, sufficient reasoning for structured skill comparison. Do not use claude-opus for per-candidate calls — cost will be prohibitive at scale. Reserve Sonnet for cases where Haiku produces poor match explanations. |

**Confidence:** MEDIUM — @anthropic-ai/sdk version ^0.24 reflects late 2024 releases. Verify latest at https://www.npmjs.com/package/@anthropic-ai/sdk before pinning. The model recommendation is based on 2024 model availability; check https://docs.anthropic.com/en/docs/about-claude/models for the current recommended fast model.

**API key storage:** Store in `chrome.storage.local` (never `chrome.storage.sync` — sync sends data to Google's servers). The background service worker reads the key at call time; the content script never touches it.

**Why not OpenAI / Gemini:** Project constraint specifies Anthropic Claude. No evaluation needed.
**Why not a serverless proxy:** Project constraint is no backend. The API key lives locally, user-provided, never leaves the device except in direct calls to Anthropic's API endpoint.

**IMPORTANT — MV3 fetch restriction:** MV3 service workers can make `fetch()` calls to external origins only if those origins are declared in `host_permissions` in manifest.json. Add `"https://api.anthropic.com/*"` to host_permissions. The `@anthropic-ai/sdk` uses fetch internally and will fail silently without this permission.

---

### Storage

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| chrome.storage.local / browser.storage.local | Browser API | Candidate records, job descriptions, API key, tier assignments | No IndexedDB needed for this data volume. chrome.storage.local supports up to 10MB (unlimited with `unlimitedStorage` permission). Each candidate record is <5KB. Storage is persistent across browser restarts, survives extension updates, and survives page navigation — unlike sessionStorage or window globals. |
| @types/chrome | ^0.0.260 | TypeScript types for Chrome extension APIs | Required for type-safe access to chrome.storage, chrome.notifications, chrome.alarms. Install as devDependency. |
| webextension-polyfill | ^0.12 | browser.* namespace for cross-browser API calls | Wraps chrome.* in a Promise-based browser.* API. Allows single codebase to work on both Chrome and Safari. WXT bundles this automatically — verify WXT version includes it before adding manually. |

**Confidence:** HIGH — chrome.storage.local is the canonical extension storage solution. The polyfill situation is well-documented.

**Why not IndexedDB:** Overkill for this data volume. No complex querying needed. chrome.storage.local is simpler to serialize and backup to CSV.
**Why not localStorage:** Not accessible from background service workers in MV3. chrome.storage.local is accessible from all extension contexts.

---

### CSV Export

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Manual CSV serialization (no library) | n/a | Export candidate records | The data shape is fixed: ~10 columns per candidate. A 15-line function handles quoting and escaping reliably. Adding a CSV library (Papa Parse, csv-stringify) for a fixed-schema export is unnecessary dependency weight. Use the Blob + URL.createObjectURL + chrome.downloads.download() pattern for file download from the service worker. |

**Confidence:** HIGH — this is a well-established pattern in extension development.

**Implementation pattern:**
```typescript
// In background service worker
function recordsToCsv(records: CandidateRecord[]): string {
  const headers = ['name','tier','score','profileUrl','evaluatedAt','contactAfter','outreachMessage'];
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = records.map(r => headers.map(h => escape((r as any)[h] ?? '')).join(','));
  return [headers.join(','), ...rows].join('\r\n');
}

// Download via chrome.downloads API
const blob = new Blob([csv], { type: 'text/csv' });
const url = URL.createObjectURL(blob);
await chrome.downloads.download({ url, filename: 'candidates.csv', saveAs: true });
```

**Why not Papa Parse:** Papa Parse is a CSV parser (reading), not primarily a writer. Its UnParse function works but adds 25KB for a task that is 15 lines of code.
**Why not csv-stringify:** Node.js streaming API not browser-native. Would require a browserify/polyfill shim. Not worth it.

---

### Notifications and Scheduling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| chrome.alarms API | Browser API | Schedule Layer 3 7-day notification trigger | MV3 service workers terminate when idle — they cannot use setTimeout for long-duration scheduling. chrome.alarms is the MV3-correct solution: registers a persistent alarm that wakes the service worker when triggered, even after browser restart. |
| chrome.notifications API | Browser API | Show browser notification when Layer 3 delay expires | Native notification with action buttons. Requires "notifications" in manifest permissions. User must grant notification permission once. |

**Confidence:** HIGH — chrome.alarms is the documented MV3 replacement for background page timers. This is not a workaround; it is the intended pattern.

**Why not setTimeout:** Service workers in MV3 terminate after ~30 seconds of inactivity. A setTimeout for 7 days will never fire.
**Why not the Web Notifications API (new Notification()):** The Web Notifications API is not available in MV3 service worker context. Must use chrome.notifications.create() instead.

**Safari alarm compatibility note:** Safari supports `browser.alarms` via the WebExtensions polyfill, but alarm behavior on Safari has historically had reliability issues with the service worker lifecycle. Test on Safari explicitly. The Xcode-wrapped app must remain installed (not just enabled) for alarms to fire reliably.

---

### Development Tooling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | ^20 LTS | Build environment | Required by WXT. Use Node 20 LTS (not 22) for maximum compatibility with native extension tooling. |
| pnpm | ^9 | Package manager | Faster than npm, better monorepo support if the project later splits the Xcode wrapper into a separate workspace. WXT documentation uses pnpm in examples. |
| ESLint + typescript-eslint | ^7 | Linting | Catches common extension anti-patterns (e.g., accessing window in service worker context). |
| Vitest | ^1.6 | Unit testing | WXT-native test runner. Use for testing the skill-matching logic (hybrid scoring algorithm) and CSV serialization. Do not test DOM parsing with Vitest — use manual testing against real LinkedIn profiles. |

**Confidence:** MEDIUM — tooling versions reflect 2024 ecosystem. Verify before project start.

---

## Safari-Specific Packaging

Safari Web Extensions are distributed as macOS apps wrapping the extension. The workflow is:

**Step 1 — Convert the Chrome extension to a Safari extension project:**
```bash
xcrun safari-web-extension-converter ./dist/chrome-mv3 \
  --project-location ./safari-extension \
  --app-name "LinkedIn HHRH Screener" \
  --bundle-identifier com.yourcompany.linkedin-hhrh-screener \
  --swift
```
This generates an Xcode project with the extension embedded as an app extension target.

**Step 2 — Open in Xcode and configure signing:**
Requires an Apple Developer account ($99/year). Set the team and bundle identifier in Xcode's Signing & Capabilities pane.

**Step 3 — Build for local use or App Store:**
- Local/sideloaded: Allow unsigned extensions in Safari Developer menu (macOS only, not distributable).
- App Store: Submit the macOS app through App Store Connect. Safari extensions on macOS must be distributed via the Mac App Store for non-developer end users.

**Key constraints:**
- The Xcode project is regenerated each time you run the converter. Keep a `safari-patches/` directory for any Xcode-specific changes and reapply after regeneration, or script the patch application.
- Safari's Content Security Policy for extensions is stricter than Chrome's. Avoid `eval()` and dynamic code execution (WXT already enforces this).
- Safari on iOS/iPadOS also supports Web Extensions as of Safari 15, but requires a separate iOS app target in Xcode. Consider this out of scope for v1.
- The `browser.alarms` API on Safari has known issues with alarm persistence when the browser is quit. Document this limitation for end users.

**Confidence:** MEDIUM — xcrun safari-web-extension-converter workflow is documented by Apple and stable since macOS Monterey. Exact Xcode project structure may vary with Xcode 16. Verify against https://developer.apple.com/documentation/safariservices/safari-web-extensions before the Safari milestone.

---

## Manifest V3 Requirements (Chrome)

The `manifest.json` must include:

```json
{
  "manifest_version": 3,
  "permissions": [
    "storage",
    "alarms",
    "notifications",
    "downloads",
    "activeTab"
  ],
  "host_permissions": [
    "https://www.linkedin.com/*",
    "https://api.anthropic.com/*"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [{
    "matches": ["https://www.linkedin.com/in/*"],
    "js": ["content.js"]
  }],
  "action": {
    "default_popup": "popup.html"
  }
}
```

**Critical MV3 differences from MV2:**
- `background.scripts` is replaced by `background.service_worker` — a single file, not an array.
- Service workers cannot access `window`, `document`, or `localStorage`.
- All long-running background tasks must use `chrome.alarms`, not `setTimeout`/`setInterval`.
- Remote code execution is prohibited (no `eval`, no loading scripts from external URLs).
- `host_permissions` is separate from `permissions` — both must be declared.

**Confidence:** HIGH — MV3 specification is stable and documented at https://developer.chrome.com/docs/extensions/mv3/intro/

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Extension framework | WXT | Plasmo | Plasmo forces React; CSP conflicts in extension context; larger bundle |
| Extension framework | WXT | CRXJS | Stalled maintenance as of 2024 |
| Extension framework | WXT | Plain Vite + manifest.json | Requires manual MV3 + Safari adaptation; WXT solves this already |
| UI framework | Vanilla TS | React | 40KB overhead; unnecessary for 5-element popup UI |
| UI framework | Vanilla TS | Svelte | WXT + Svelte integration less documented; vanilla is simpler |
| AI SDK | @anthropic-ai/sdk | Direct fetch() to Anthropic API | SDK handles error types, retries, and streaming; no reason to reimplement |
| CSV export | Manual serialization | Papa Parse | Papa Parse is a parser; its writer adds 25KB for 15 lines of work |
| CSV export | Manual serialization | csv-stringify | Node.js streaming API; requires polyfill in browser context |
| Storage | chrome.storage.local | IndexedDB | Overkill for this data volume; no complex querying needed |
| Storage | chrome.storage.local | localStorage | Not accessible from MV3 service workers |
| Scheduling | chrome.alarms | setTimeout | setTimeout does not survive MV3 service worker termination |
| Notifications | chrome.notifications | Web Notifications API | Not available in MV3 service worker context |

---

## Installation

```bash
# Initialize project with WXT
pnpm create wxt@latest linkedin-hhrh-screener
cd linkedin-hhrh-screener

# Core runtime dependencies
pnpm add @anthropic-ai/sdk webextension-polyfill

# Dev dependencies
pnpm add -D typescript @types/chrome eslint typescript-eslint vitest
```

---

## Sources

- WXT framework: https://wxt.dev (MEDIUM confidence — version from 2024 ecosystem knowledge)
- Chrome MV3 overview: https://developer.chrome.com/docs/extensions/mv3/intro/ (HIGH confidence — stable spec)
- Chrome alarms API: https://developer.chrome.com/docs/extensions/reference/alarms/ (HIGH confidence)
- Chrome storage API: https://developer.chrome.com/docs/extensions/reference/storage/ (HIGH confidence)
- Safari Web Extension converter: https://developer.apple.com/documentation/safariservices/converting-a-web-extension-for-safari (MEDIUM confidence — Xcode version may affect workflow)
- Anthropic SDK npm: https://www.npmjs.com/package/@anthropic-ai/sdk (MEDIUM confidence — version pinned to late 2024 knowledge)
- Anthropic models list: https://docs.anthropic.com/en/docs/about-claude/models (verify current fast model before implementing)

---

## Open Questions for Phase Research

1. **Anthropic SDK in service worker context:** The `@anthropic-ai/sdk` uses the fetch API internally. Confirm it does not reference `XMLHttpRequest` or `process` (Node.js globals) which are unavailable in MV3 service workers. If it does, a thin wrapper calling `fetch()` directly to `https://api.anthropic.com/v1/messages` is the fallback.

2. **WXT + Safari output:** Verify that WXT's `--browser safari` build output produces a structure compatible with `xcrun safari-web-extension-converter` without manual restructuring.

3. **LinkedIn DOM stability:** LinkedIn uses React and server-side rendering with frequent class/attribute changes. The content script's DOM selectors will need maintenance. Consider targeting `data-*` attributes and semantic HTML elements over brittle class names. This is a recurring operational concern, not a stack decision.

4. **chrome.alarms on Safari:** Apple's documentation acknowledges alarm behavior differences. Test the 7-day Layer 3 notification on Safari before shipping that feature.
