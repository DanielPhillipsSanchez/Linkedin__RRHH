# Project Research Summary

**Project:** LinkedIn HHRR Candidate Screener
**Domain:** Browser extension — AI-assisted LinkedIn candidate screening for solo recruiters
**Researched:** 2026-03-06
**Confidence:** MEDIUM-HIGH

## Executive Summary

This project is a Manifest V3 browser extension (Chrome + Safari) that reads LinkedIn profile pages, scores candidates against stored job descriptions using a hybrid keyword + Claude AI approach, classifies them into four contact tiers, generates personalized outreach messages, and tracks evaluation history locally with CSV export. The target user is a solo recruiter or small HR team. There is no backend — all data lives in `chrome.storage.local`, and the only outbound calls are to Anthropic's Claude API using a user-supplied key. This architecture is deliberate: it eliminates infrastructure costs, signup friction, and data-sharing liability, at the cost of device-bound storage and a 10MB capacity ceiling.

The recommended implementation approach is WXT (Web Extension Tools) as the build framework, TypeScript with vanilla DOM (no React), Claude Haiku 3.5 for per-candidate scoring, and `chrome.storage.local` for all persistence. The MV3 architecture enforces a strict separation of concerns: content scripts read the LinkedIn DOM, the background service worker owns all external API calls and storage writes, and the popup/options pages are pure UI layers. Every significant decision in the stack — alarms instead of `setTimeout`, storage instead of in-memory state, background service worker instead of content script for API calls — is driven by MV3's non-persistent service worker lifecycle. These constraints are well-understood and the patterns to address them are established.

The two highest risks are LinkedIn DOM selector fragility (LinkedIn redeploys with obfuscated class names frequently, silently breaking extraction) and Safari packaging complexity (Safari requires Xcode wrapping and is not a simple port of the Chrome build). Both risks must be treated as first-class architecture concerns in Phase 1, not deferred. The core feature dependency chain is linear: API key → JD storage → profile parsing → scoring → tier classification → everything else. This makes phase ordering straightforward.

---

## Key Findings

### Recommended Stack

WXT (Web Extension Tools) is the current standard for cross-browser MV3 extensions, replacing stalled alternatives like CRXJS and manual Vite configurations. It handles manifest generation, HMR, and Safari output preparation from a single codebase. The UI layer should be vanilla TypeScript — the extension popup has approximately 5 interactive elements and no state management complexity that justifies React's 40KB overhead or the CSP configuration it requires. Shadow DOM isolation is required for any UI injected into the LinkedIn page.

The Anthropic SDK (`@anthropic-ai/sdk`) is called exclusively from the background service worker — never the content script — due to CORS constraints and API key security. Claude Haiku 3.5 is the correct model: fast and cheap enough for per-candidate scoring at scale. Opus would be cost-prohibitive. Scheduling uses `chrome.alarms` (not `setTimeout`) because MV3 service workers terminate after ~30 seconds idle; alarms are browser-persisted and survive worker restarts. CSV export is a manual 15-line function — no library needed for a fixed-schema export.

**Core technologies:**
- WXT ^0.19: Cross-browser extension build framework — eliminates manual MV3 + Safari wiring
- TypeScript ^5.4: Type-safe development — catches chrome.* API shape mismatches early
- @anthropic-ai/sdk ^0.24: Claude API client — called from service worker only; key never touches content script
- claude-haiku-3-5: AI model for scoring — fast and cheap; reserve Sonnet for explanation quality edge cases
- chrome.storage.local: Persistence — accessible from background/popup/options; survives restarts; sufficient for ~5,000+ candidates
- chrome.alarms: Layer 3 7-day scheduling — only MV3-correct solution for long-duration background timers
- webextension-polyfill ^0.12: Cross-browser `browser.*` namespace — enables shared Chrome/Safari codebase

### Expected Features

**Must have (table stakes):**
- Settings page with Claude API key entry and validation — required before any AI call works
- Job description storage with CRUD (create, select, delete, support multiple JDs) — foundation for scoring context
- Profile data extraction from LinkedIn DOM (name, headline, skills, experience, education) — the entire product depends on this
- Hybrid keyword + Claude scoring against selected JD — core value proposition
- Tier classification display: L1 (≥80%), L2 (71-79%), L3 (60-70%), Rejected (<60%) with score
- Score explainability (matched skills, missing skills, brief rationale) — without this the score is untrustworthy
- Candidate history log stored locally — recruiter must recall prior decisions
- Outreach message generation with tier-appropriate variant (standard for L1/L2, delayed-contact framing for L3)
- Message review panel with editable text and copy-to-clipboard — auto-send is explicitly excluded
- CSV export of all evaluated candidates

**Should have (competitive differentiators):**
- Hybrid scoring gate: keyword-only for clear matches/rejections (≥90 or ≤40), Claude only for ambiguous range (41-89) — reduces API cost and latency significantly
- L3 7-day contact scheduling via `chrome.alarms` + `chrome.notifications` with in-UI fallback
- Multiple saved JDs with per-candidate JD attribution in history
- Fully local / no account required — privacy differentiator for privacy-conscious HR teams

**Defer (v2+):**
- Multiple JD UI polish (rename, reorder)
- Import/export of candidate history as JSON for manual team sharing
- Prompt tuning UI for message tone/style customization
- Tier distribution analytics across all evaluated candidates

### Architecture Approach

The extension is a collection of four isolated execution contexts communicating via message passing. The content script reads the LinkedIn DOM and relays a serialized `ProfileData` object to the background service worker via `chrome.runtime.sendMessage`. The background service worker owns all Claude API calls, tier assignment, alarm creation, and storage writes. The popup is a stateless display layer that reads from `chrome.storage.local` on every open — it never relies on live messages because the popup can be closed and the service worker can die mid-operation. The options page handles API key and JD management. All state persists to storage before any message notification is sent; live messages are for UI feedback only.

**Major components:**
1. Content Script — reads LinkedIn DOM on `linkedin.com/in/*` pages; must handle SPA navigation (LinkedIn does not reload pages on profile navigation); uses Shadow DOM for any injected UI
2. Background Service Worker — API gateway for all Claude calls; alarm-based scheduling; storage writes; never holds in-memory state across message handler invocations
3. Popup UI — stateless result display; reads from storage on open; triggers extraction flow
4. Options Page — API key entry, JD management, data retention controls; writes directly to storage
5. chrome.storage.local — source of truth for all data; flat namespaced key-value schema (`settings:*`, `jd:*`, `candidate:*`)

### Critical Pitfalls

1. **LinkedIn DOM selector rot** — LinkedIn rebuilds its frontend with obfuscated class names frequently and without notice. Use `aria-label`, semantic HTML, and element hierarchy; abstract all selectors into a single `selectors.ts` config file; implement extraction health-check that reports missing fields to the recruiter rather than silently scoring on partial data.

2. **MV3 service worker termination during API calls** — The service worker can die mid-Claude-call. Structure code so the fetch itself is the active operation (service worker stays alive while a fetch is in-flight); write pending request state to `chrome.storage.session` for retry on restart; always set a 20-second hard timeout and surface a visible error rather than an infinite spinner.

3. **API key exposure in content script context** — The API key must only ever be read in the background service worker. Content scripts send profile data to the background; the background reads the key, calls Claude, and returns results. The key never passes through the content script.

4. **Safari is a separate build target, not a port** — Safari requires Xcode packaging, an Apple Developer account ($99/year), code signing, and explicit testing on a physical Mac. Use `webextension-polyfill` for `browser.*` namespace and generate the Xcode project in Phase 1. Deferring Safari setup until "Chrome is done" adds 1-2 weeks of surprise work at the end of the project.

5. **Notification permission failure silences Layer 3 scheduling** — Notification permission must be requested during onboarding with clear explanation. Always implement a dual-track reminder system: `chrome.alarms` for the timer (does not require notification permission) plus an in-extension UI badge showing overdue L3 contacts as a fallback when system notifications are blocked.

---

## Implications for Roadmap

Based on the critical path from FEATURES.md (`Settings → JD Storage → Profile Parsing → AI Scoring → Tier Classification`), the hard architectural dependency on the API key before any end-to-end test is possible, and the pitfall research emphasis on getting security and storage architecture correct before building atop them, the following phase structure is recommended.

### Phase 1: Foundation — Extension Scaffold, Storage, Settings, and Safari Setup

**Rationale:** Every subsequent phase depends on: (a) a working WXT build that targets both Chrome and Safari, (b) a storage schema that encodes data retention and security from the start, and (c) an options page with API key entry. Getting any of these wrong requires rewrites. The Safari Xcode project must also be established here — not at the end — to prevent a multi-week surprise.

**Delivers:** Working extension shell loadable in Chrome and Safari dev mode; `chrome.storage.local` schema with namespaced keys for settings, JDs, and candidates; API key entry and validation in options page; JD CRUD in options page; manifest with all required permissions declared; MV3-compliant CSP (no inline scripts); Shadow DOM setup for any future content script UI injection; `selectors.ts` abstraction layer initialized (even if selectors are placeholders); Xcode project committed to version control.

**Addresses:** Settings, JD storage (table stakes); multi-JD management (differentiator)

**Avoids:** API key in content script (Pitfall 3); Safari packaging surprise (Pitfall 4); GDPR retention — expiry timestamps in schema (Pitfall 9); storage quota — minimal data schema (Pitfall 7); CSP inline script failure (Pitfall 10); Chrome/Safari version drift (Pitfall 12)

**Research flag:** Safari alarm reliability on current Safari version should be verified against Apple docs before the notification phase. No additional `/gsd:research-phase` needed for Phase 1 itself — patterns are well-established.

---

### Phase 2: Content Script and Profile Extraction

**Rationale:** Profile data is the input to everything downstream. Building and validating the DOM extraction layer independently — before the AI integration — allows offline testing of the most fragile component. The extraction health-check should be in place before any scoring code depends on the extracted data.

**Delivers:** Content script injected on `linkedin.com/in/*` pages; DOM extraction for name, headline, About, Experience, Skills, Education; serialized `ProfileData` type; message relay from content script to background; SPA navigation detection (URL change observer or `chrome.webNavigation.onHistoryStateUpdated`); extraction health-check with field-level success/failure reporting surfaced to the popup.

**Addresses:** Profile data parsing from LinkedIn DOM (table stakes)

**Avoids:** LinkedIn DOM selector rot — all selectors in `selectors.ts`, semantic attributes over class names (Pitfall 1); SPA navigation stale data (Pitfall 11); LinkedIn fingerprinting — popup UI, no injected panel (Pitfall 13)

**Research flag:** Requires live validation against current LinkedIn DOM to establish working selectors. This is the one phase where real-browser manual testing is mandatory before proceeding. No library or documentation covers this — it requires opening LinkedIn and inspecting the current DOM.

---

### Phase 3: Background Service Worker and AI Scoring Pipeline

**Rationale:** With the storage schema and profile extraction in place, the core value loop can be built: profile data in → score and tier out. This phase implements the hybrid scoring gate (keyword-first, Claude only for ambiguous range), the Claude API integration, tier assignment, candidate record persistence, and message generation. All security constraints (API key in background only, delimited prompts) are enforced here.

**Delivers:** Keyword scoring engine (testable offline without API key); Claude API integration via `@anthropic-ai/sdk` called from service worker; hybrid scoring gate logic (keyword-only for ≥90 or ≤40, Claude for 41-89); tier assignment (L1/L2/L3/Rejected); outreach message generation with tier-appropriate Claude prompt variant; prompt injection defense via XML-delimited candidate data sections; candidate record write to `chrome.storage.local`; typed message protocol enum shared across contexts; hard 20-second API timeout with user-facing error.

**Addresses:** Hybrid keyword + Claude scoring, tier classification, score explainability, outreach message generation (table stakes and differentiators)

**Avoids:** Service worker termination mid-call (Pitfall 2); API key exposure (Pitfall 3); prompt injection (Pitfall 8); LinkedIn ToS violation — messaging hard stop before LinkedIn "Send" button (Pitfall 6)

**Research flag:** Verify that `@anthropic-ai/sdk` does not reference `XMLHttpRequest` or Node.js `process` globals before integrating — if it does, fall back to direct `fetch()` to the Anthropic API. Also verify current Claude Haiku model ID at https://docs.anthropic.com/en/docs/about-claude/models.

---

### Phase 4: Popup UI and End-to-End Flow

**Rationale:** With the scoring pipeline complete and data persisting to storage, the popup can be built as a stateless read layer. This is the phase where the full recruiter workflow becomes testable for the first time. Message review, copy-to-clipboard, and LinkedIn message compose trigger are also built here.

**Delivers:** Extension popup UI (score badge, tier label, matched/missing skills panel, outreach message textarea); popup reads from `chrome.storage.local` on every open (stateless, resilient to service worker restarts); "Evaluate" button triggers extraction → scoring pipeline; editable message textarea with copy-to-clipboard; "Open LinkedIn Messaging" action (URL scheme or DOM highlight — manual send only, no auto-send); candidate history view in popup; CSV export (Blob + `URL.createObjectURL` + `chrome.downloads.download()`).

**Addresses:** Extension popup UI, message review panel, candidate history log, CSV export (table stakes)

**Avoids:** Auto-send violation (Pitfall 6 — hard stop at message compose, recruiter sends manually)

**Research flag:** Standard patterns. No additional research needed.

---

### Phase 5: Scheduling, Notifications, and Data Management

**Rationale:** The Layer 3 7-day scheduling feature and data retention controls are last because they depend on the full scoring pipeline (tiers must exist before alarms are set) and do not block the core loop. Notification permission must be requested during onboarding, not silently.

**Delivers:** `chrome.alarms.create()` for L3 candidates (7-day delay, 10,080 minutes); `chrome.notifications.create()` from alarm handler in service worker; onboarding notification permission request with plain-language explanation; in-popup overdue L3 badge as fallback when notifications are blocked; storage quota monitoring via `chrome.storage.local.getBytesInUse()` with recruiter warning; "Clear old evaluations" option in settings; configurable data retention period (90-day default); "Delete all candidate data" button for GDPR compliance.

**Addresses:** L3 browser notification, tiered contact scheduling (differentiators); data retention/deletion (GDPR compliance)

**Avoids:** Notification permission silent failure (Pitfall 5); storage quota overflow (Pitfall 7); GDPR exposure (Pitfall 9)

**Research flag:** Verify Safari 16+ `browser.alarms` reliability against current Apple documentation before signing off on this phase. Safari notification entitlements in the Xcode project must be confirmed.

---

### Phase 6: Safari Packaging and Cross-Browser Verification

**Rationale:** By Phase 6 all Chrome functionality is stable. The Xcode project already exists (created in Phase 1) so this is build configuration, signing, testing, and App Store submission — not a new architecture effort. Both targets must be verified to match feature parity and version numbers.

**Delivers:** Signed Safari extension in Xcode; Chrome and Safari builds verified at feature parity; both builds passing before any release cut; Apple App Store submission (if distribution beyond developer mode is required).

**Avoids:** Chrome/Safari version drift (Pitfall 12); Safari packaging surprise (already mitigated in Phase 1, but this phase closes it out)

**Research flag:** Verify `xcrun safari-web-extension-converter` output structure with current Xcode version before the conversion step. Verify minimum Safari version support (16+ for `browser.alarms`).

---

### Phase Ordering Rationale

- Phase 1 before everything else: security architecture (API key handling) and storage schema cannot be retrofitted cleanly; Safari Xcode setup is far cheaper in Phase 1 than Phase 6.
- Phase 2 before Phase 3: scoring needs real profile data to be tested end-to-end; the extraction layer is the most fragile component and must be validated independently first.
- Phase 3 before Phase 4: the popup is a display layer with no logic of its own; it requires storage data to display. Building UI before the data pipeline exists produces a UI with nothing to show.
- Phase 4 before Phase 5: scheduling requires tiers; tiers come from the scoring pipeline; both must be working before alarm creation code is meaningful.
- Phase 5 before Phase 6: all functionality must be complete and stable in Chrome before the Safari build is finalized.

### Research Flags

Phases needing deeper research or live validation during planning:

- **Phase 2 (DOM extraction):** Live LinkedIn DOM inspection required. No documentation covers current LinkedIn markup — must open a LinkedIn profile and map selectors against current rendered output before writing extraction code. This is the highest-fragility surface in the project.
- **Phase 3 (AI integration):** Verify `@anthropic-ai/sdk` service worker compatibility and current Haiku model ID before implementation begins.
- **Phase 5 (Safari notifications):** Safari 16+ alarm and notification behavior should be verified against current Apple documentation, as this lagged Chrome at training cutoff.

Phases with standard, well-documented patterns (skip `/gsd:research-phase`):

- **Phase 1:** WXT setup, MV3 manifest, chrome.storage.local schema — all extensively documented.
- **Phase 4:** Popup UI with Blob-based CSV download — standard extension patterns.
- **Phase 6:** `xcrun safari-web-extension-converter` workflow is documented by Apple and stable since macOS Monterey.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | WXT, @anthropic-ai/sdk, chrome.alarms patterns are well-established. Specific version numbers (WXT ^0.19, SDK ^0.24) should be verified against npm before pinning. |
| Features | HIGH | Feature set is directly derived from PROJECT.md requirements plus domain knowledge of competing tools. Anti-features are clearly scoped. |
| Architecture | HIGH | MV3 component isolation, message passing, and service worker lifecycle are stable, well-documented specifications. CORS constraints and storage access rules are authoritative. |
| Pitfalls | MEDIUM-HIGH | MV3 lifecycle, CSP, API key security, and SPA navigation are HIGH confidence. LinkedIn-specific DOM behavior (selector rot, fingerprinting detection) is MEDIUM — requires live validation. GDPR interpretation for local storage is MEDIUM — enterprise users should verify with counsel. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **LinkedIn DOM selectors (Phase 2):** No current-state selector mapping exists. Must inspect LinkedIn profile DOM live before writing extraction code. Build the `selectors.ts` abstraction layer and health-check first; populate selectors second.
- **Anthropic SDK service worker compatibility (Phase 3):** Confirm `@anthropic-ai/sdk` uses only `fetch()` and no Node.js globals. If it references `process` or `XMLHttpRequest`, fall back to direct `fetch()` calls to `https://api.anthropic.com/v1/messages`.
- **Current Claude model IDs (Phase 3):** Verify the recommended fast model at https://docs.anthropic.com/en/docs/about-claude/models — the model names used in training knowledge may be superseded.
- **Safari alarm reliability (Phase 5):** Safari's `browser.alarms` behavior at the time of build should be verified against Apple documentation, particularly for persistence across browser quit/restart.
- **Storage quota under `unlimitedStorage` (Phase 1):** If `"unlimitedStorage"` permission is requested in the manifest, verify current Chrome Web Store review expectations for that permission declaration.

---

## Sources

### Primary (HIGH confidence)
- Chrome Extensions Manifest V3 specification — service worker lifecycle, MV3 permissions, CSP requirements, alarms API, storage API, message passing
- WebExtensions API — component isolation, `browser.*` namespace, CORS constraints for content scripts
- Mozilla webextension-polyfill — cross-browser namespace compatibility

### Secondary (MEDIUM confidence)
- WXT framework (https://wxt.dev) — build tooling, version numbers reflect late 2024/early 2025 releases; verify before pinning
- Anthropic SDK npm (https://www.npmjs.com/package/@anthropic-ai/sdk) — version ^0.24 based on late 2024 knowledge
- Anthropic models documentation (https://docs.anthropic.com/en/docs/about-claude/models) — Haiku 3.5 recommendation based on 2024 model availability
- Apple Safari Web Extension converter documentation — packaging workflow stable since macOS Monterey; Xcode 16 specifics should be re-verified
- LinkedIn recruiter extension ecosystem (Dux-Soup, Wiza, Gem, PhantomBuster feature sets) — MEDIUM confidence, based on training knowledge through August 2025

### Tertiary (LOW confidence — requires live validation)
- LinkedIn DOM structure and semantic attribute availability — must inspect current production LinkedIn markup
- LinkedIn automated action detection heuristics — not publicly documented; anecdotal community reports only

---

*Research completed: 2026-03-06*
*Ready for roadmap: yes*
