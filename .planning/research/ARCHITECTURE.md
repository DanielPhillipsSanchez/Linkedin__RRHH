# Architecture Patterns

**Domain:** Browser extension — LinkedIn candidate screening with AI scoring
**Project:** LinkedIn HHRR Candidate Screener
**Researched:** 2026-03-06
**Confidence:** HIGH (MV3 architecture is stable, well-documented, and based on the WebExtensions specification)

---

## Recommended Architecture

A Manifest V3 (MV3) browser extension is not a single application — it is a collection of isolated execution contexts that communicate via message passing. Each context has distinct capabilities, lifecycle, and storage access rules.

```
┌─────────────────────────────────────────────────────────────────────┐
│  LinkedIn Tab (linkedin.com/in/*)                                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  CONTENT SCRIPT (content.js)                                │   │
│  │  - Injected by manifest into linkedin.com/in/* pages        │   │
│  │  - Reads DOM: name, headline, skills, experience, education  │   │
│  │  - Serializes profile → plain JS object                     │   │
│  │  - Sends to background via chrome.runtime.sendMessage       │   │
│  │  - Cannot call Claude API directly (CORS blocked)           │   │
│  └─────────────┬───────────────────────────────────────────────┘   │
└────────────────│────────────────────────────────────────────────────┘
                 │ chrome.runtime.sendMessage({ type: "PROFILE_DATA", payload })
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  BACKGROUND SERVICE WORKER (background.js)                          │
│  - Event-driven, not persistent (MV3 constraint)                    │
│  - Wakes on: messages, alarms, notifications clicks                 │
│  - Owns all Claude API calls (fetch to api.anthropic.com)           │
│  - Manages chrome.alarms for Layer 3 7-day reminders                │
│  - Reads/writes chrome.storage.local                                │
│  - Routes results back to popup via chrome.runtime.sendMessage      │
│  - Dies after ~30s idle (must not hold in-memory state)             │
└────────────┬───────────────────────────────────────────────────────┘
             │ chrome.runtime.sendMessage({ type: "SCORE_RESULT", payload })
             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  POPUP UI (popup.html + popup.js)                                   │
│  - Opens when recruiter clicks the extension icon                   │
│  - Triggers "EXTRACT_PROFILE" → content script via tabs.sendMessage │
│  - Displays score, tier, and generated message                      │
│  - "Export CSV" button reads all candidates from storage            │
│  - Links to Options page for API key + JD management                │
│  - Destroyed when closed (no persistent state)                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  OPTIONS PAGE (options.html + options.js)                           │
│  - Standalone page opened via chrome.runtime.openOptionsPage()      │
│  - Recruiter sets: Claude API key, job descriptions                 │
│  - Reads/writes chrome.storage.local directly                       │
│  - Input validation only — no API calls here                        │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  SHARED STORAGE  (chrome.storage.local)                             │
│  - Accessible from: background, popup, options (NOT content script  │
│    without explicit message relay)                                  │
│  - Stores: API key, job descriptions, evaluated candidates          │
│  - Max ~10MB; sufficient for hundreds of candidate records          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

| Component | Runs In | Can Access DOM | Can Call External APIs | Can Use chrome.storage | Lifecycle |
|-----------|---------|---------------|----------------------|----------------------|-----------|
| Content Script | LinkedIn tab page context | YES (linkedin.com only) | NO (CORS blocked by LinkedIn headers) | NO (must relay via background) | Lives while tab is open |
| Background Service Worker | Browser background | NO | YES (fetch unrestricted) | YES | Event-driven, ~30s idle timeout |
| Popup | Extension popup window | NO | YES (but delegate to background) | YES | Destroyed on close |
| Options Page | Extension tab/window | NO | NO | YES | Lives while page open |

**Critical boundary rule:** Content scripts cannot make cross-origin fetch requests to `api.anthropic.com`. This is a hard CORS constraint enforced by the browser. ALL Claude API calls MUST be routed through the background service worker.

---

## Data Flow

The flow below represents the happy path for scoring a single candidate.

```
1. RECRUITER ACTION
   Recruiter clicks extension icon → Popup opens

2. POPUP → CONTENT SCRIPT (trigger extraction)
   popup.js
     chrome.tabs.sendMessage(tabId, { type: "EXTRACT_PROFILE" })

3. CONTENT SCRIPT → DOM READING
   content.js
     Reads: profile name, headline, About section, Experience items,
            Skills section, Education items
     Serializes → ProfileData object (plain JSON-serializable)

4. CONTENT SCRIPT → BACKGROUND (send raw profile)
   content.js
     chrome.runtime.sendMessage({ type: "PROFILE_DATA", payload: profileData })

5. BACKGROUND: KEYWORD SCORING (fast, free)
   background.js
     Loads active JD from chrome.storage.local
     Runs keyword match: JD skills vs profile skills
     Computes raw keyword score (0–100)

6. BACKGROUND → CLAUDE API (only if needed)
   background.js
     If keyword score is ambiguous (50–85 range) OR soft skills matter:
       POST fetch("https://api.anthropic.com/v1/messages", ...)
       Body: { profile snippet, JD requirements, scoring rubric }
       Reads API key from chrome.storage.local
     Receives: { finalScore, tierReason, outreachMessage }

7. BACKGROUND: TIER ASSIGNMENT + STORAGE
   background.js
     Assigns tier: L1 (≥80), L2 (71–79), L3 (60–70), Rejected (<60)
     If L3: chrome.alarms.create("layer3-{candidateId}", { delayInMinutes: 10080 })
     Writes candidate record to chrome.storage.local:
       { id, name, score, tier, outreachMessage, evaluatedAt, contactAfter? }

8. BACKGROUND → POPUP (return result)
   background.js
     chrome.runtime.sendMessage({ type: "SCORE_RESULT", payload: result })

9. POPUP: DISPLAY
   popup.js
     Renders: score badge, tier label, outreach message textarea
     Recruiter edits message → clicks "Open LinkedIn Messaging"
     (Opens linkedin.com/messaging or highlights message compose area)

10. CSV EXPORT (on demand)
    popup.js (or options.js)
      Reads all candidates from chrome.storage.local
      Serializes to CSV string
      Triggers browser download via Blob + URL.createObjectURL

11. LAYER 3 REMINDER (7 days later)
    background.js wakes on chrome.alarms.onAlarm
      Fires chrome.notifications.create(...)
      Recruiter clicks notification → popup opens with candidate record
```

---

## Message Passing Patterns

### Pattern 1: Popup → Content Script (Request)

The popup cannot directly read the LinkedIn DOM. It must ask the content script to do it.

```javascript
// popup.js
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_PROFILE" }, (response) => {
  // response.profile = ProfileData object
});

// content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "EXTRACT_PROFILE") {
    const profile = extractProfileFromDOM();
    sendResponse({ profile });
  }
  return true; // Keep channel open for async sendResponse
});
```

### Pattern 2: Background as API Gateway

All external API calls go through the background worker. This is both a CORS requirement and a clean separation of concerns.

```javascript
// popup.js sends a score request
chrome.runtime.sendMessage({ type: "SCORE_CANDIDATE", payload: { profile, jdId } });

// background.js handles it
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SCORE_CANDIDATE") {
    scoreCandidate(message.payload).then(result => sendResponse({ result }));
    return true; // CRITICAL: return true for async sendResponse
  }
});
```

**Gotcha:** If `sendResponse` is called after the message channel closes (e.g., popup closed), Chrome silently drops it. The background should always write results to `chrome.storage.local` first, then notify the popup. Popup reads from storage on open.

### Pattern 3: Storage as Source of Truth (Recommended over live messaging)

Because the popup can be closed and reopened, and the service worker can die, the canonical pattern is:

1. Background writes all results to `chrome.storage.local`
2. Popup reads from storage on open (not waiting for a live message)
3. Live messages are used only for in-session UI updates (e.g., loading spinners)

```javascript
// background.js — always persist first
await chrome.storage.local.set({ [`candidate:${id}`]: record });
// Then optionally notify any open popup
chrome.runtime.sendMessage({ type: "SCORE_COMPLETE", candidateId: id }).catch(() => {});
// catch: popup may not be open, that's fine

// popup.js — on open, load from storage
const data = await chrome.storage.local.get(null); // or specific keys
renderCandidates(data);
```

### Pattern 4: Long-Lived Port (not recommended for this project)

`chrome.runtime.connect()` creates a persistent port for streaming. This is useful for streaming Claude API responses character-by-character but adds complexity. For v1, use `sendMessage` with the full response. Streaming can be added in a later phase if needed.

---

## MV3 Service Worker Lifecycle — Critical Constraints

The MV3 service worker is the most architecturally significant constraint in this project.

### What MV3 Changed (from MV2)

| Aspect | MV2 Background Page | MV3 Service Worker |
|--------|--------------------|--------------------|
| Lifecycle | Persistent (always running) | Event-driven (starts/stops) |
| Idle timeout | Never terminates | ~30 seconds after last event |
| In-memory state | Reliable (lives forever) | Unreliable (lost on termination) |
| DOM access | No | No |
| fetch() | Yes | Yes |

### Consequences for This Project

1. **No in-memory caches.** Any state the background service worker holds in JavaScript variables (e.g., `let currentProfile = null`) will be lost when the worker terminates. All state MUST be persisted to `chrome.storage.local` before the async operation completes.

2. **Claude API calls must complete within one wakeup.** A single `fetch()` to the Claude API will keep the service worker alive until the Promise resolves. This is fine — Claude API responses typically return in 2–10 seconds. Do NOT chain multiple long waits.

3. **Do not use `setTimeout` for the 7-day Layer 3 delay.** `setTimeout` is unreliable in service workers (lost on termination). Use `chrome.alarms.create()` instead — alarms are persisted by the browser and reliably fire even after the worker has been garbage collected.

4. **Keep the worker alive trick (use sparingly).** If a multi-step async flow risks timing out, call `chrome.runtime.getPlatformInfo()` as a no-op heartbeat every ~25 seconds. This is a known workaround but is not needed for single-fetch Claude calls.

5. **Service worker registration.** The manifest must declare `"background": { "service_worker": "background.js", "type": "module" }`. The `"type": "module"` flag enables ES module imports, which simplifies code splitting.

### Alarms API for Layer 3 Scheduling

```javascript
// When L3 candidate is evaluated
chrome.alarms.create(`layer3-${candidateId}`, {
  delayInMinutes: 7 * 24 * 60  // 10,080 minutes = 7 days
});

// In background service worker
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith("layer3-")) {
    const candidateId = alarm.name.replace("layer3-", "");
    const candidate = await getCandidate(candidateId);
    chrome.notifications.create(`notify-${candidateId}`, {
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "Layer 3 Follow-Up",
      message: `Time to contact ${candidate.name}`
    });
  }
});
```

---

## Storage Schema

`chrome.storage.local` is a flat key-value store. Use namespaced keys.

```javascript
// Settings
"settings:apiKey"          → string (Claude API key)
"settings:activeJdId"      → string (UUID of selected job description)

// Job Descriptions
"jd:{uuid}"                → { id, title, description, skills: string[], createdAt }
"jd:index"                 → string[] (ordered list of JD UUIDs)

// Candidates
"candidate:{uuid}"         → {
                               id, name, profileUrl, linkedinHeadline,
                               score, tier,            // "L1"|"L2"|"L3"|"rejected"
                               outreachMessage,
                               evaluatedAt,            // ISO 8601
                               contactAfter?,          // ISO 8601, L3 only
                               jdId                    // which JD was used
                             }
"candidate:index"          → string[] (ordered by evaluatedAt desc)
```

**Storage size:** Each candidate record is ~1–2KB. 10MB limit = ~5,000–10,000 candidates. This is effectively unlimited for a solo recruiter.

---

## Safari Compatibility

Safari uses the same WebExtensions API (MV3) via the Safari Web Extension format, packaged with Xcode.

| Concern | Chrome | Safari | Notes |
|---------|--------|--------|-------|
| `chrome.*` namespace | Yes | Partial | Use `browser.*` or a polyfill for full compatibility |
| `chrome.alarms` | Yes | Yes (Safari 16+) | Verify minimum Safari version |
| `chrome.notifications` | Yes | Yes | May require explicit permission on macOS |
| Service Worker | Yes | Yes (Safari 15.4+) | Safari's MV3 support lags Chrome by ~1 release cycle |
| `fetch()` in SW | Yes | Yes | No known differences for external APIs |
| Packaging | npm build | Xcode wrapping required | `xcrun safari-web-extension-converter` converts a Chrome extension folder |

**Recommended approach:** Write to the `browser.*` namespace using the `webextension-polyfill` library from Mozilla. This provides a Promise-based API that works on both Chrome (`chrome.*`) and Safari (`browser.*`) without branching.

---

## Build Order (Phase Dependencies)

Components have hard dependencies. The build order must respect them.

```
Phase 1: Foundation
  ├── manifest.json (declares all components, permissions)
  ├── chrome.storage.local schema (defines data contracts)
  └── Options page (API key entry — required before any AI call works)
         ↓ unblocks
Phase 2: Content Script + DOM Extraction
  ├── content.js (LinkedIn DOM parser)
  └── Message relay: content → background
         ↓ unblocks
Phase 3: Background Service Worker + Scoring
  ├── Keyword scoring engine (no API key needed, testable offline)
  ├── Claude API integration (requires API key from Phase 1)
  ├── Tier assignment logic
  └── Storage write (candidate records)
         ↓ unblocks
Phase 4: Popup UI
  ├── Reads candidates from storage (requires Phase 3 to have written data)
  ├── Triggers extraction flow (requires Phase 2)
  ├── Displays score + message
  └── Opens LinkedIn messaging
         ↓ unblocks
Phase 5: Scheduling + Export
  ├── chrome.alarms (Layer 3 7-day reminders) — requires Phase 3 tier data
  ├── chrome.notifications — requires alarm infrastructure
  └── CSV export — requires candidate storage from Phase 3
         ↓ unblocks
Phase 6: Safari Packaging
  └── Xcode conversion (requires all Chrome components stable)
```

**Critical dependency:** The Options page (API key) must be built before the Claude API integration can be tested end-to-end. The keyword scoring path can be built and tested entirely offline, making it a good early confidence signal.

---

## Patterns to Follow

### Pattern: Background as Single API Gateway

All external API calls (Claude) go through the background service worker exclusively. The popup and content script are pure UI/DOM layers. This eliminates CORS problems and keeps API key handling in one place.

### Pattern: Storage-First, Notify-Second

Background always writes to `chrome.storage.local` before sending any message to the popup. Popup reads from storage on every open. This makes the popup stateless and resilient to the service worker dying mid-operation.

### Pattern: Typed Message Protocol

Define a `MessageType` enum shared across content, background, and popup. Prevents typo bugs in message routing.

```javascript
// messages.js (shared module)
export const MSG = {
  EXTRACT_PROFILE:  "EXTRACT_PROFILE",
  PROFILE_DATA:     "PROFILE_DATA",
  SCORE_CANDIDATE:  "SCORE_CANDIDATE",
  SCORE_RESULT:     "SCORE_RESULT",
  EXPORT_CSV:       "EXPORT_CSV",
};
```

### Pattern: Hybrid Scoring Gate

Run keyword scoring first. Only call Claude if the keyword score is in an ambiguous range (configurable threshold, e.g., 50–85). This reduces API costs and latency for clear matches/rejections.

```
keyword score ≥ 90  →  skip Claude, assign L1 directly
keyword score ≤ 40  →  skip Claude, assign Rejected directly
keyword score 41–89 →  call Claude for final score + message generation
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: In-Memory State in Background Service Worker

**What:** Storing candidate data or profile state in background.js JavaScript variables.

**Why bad:** Service worker terminates after ~30s idle. Variables are lost. Next message handler wakes a fresh worker with no memory of previous state.

**Instead:** Write every meaningful state change to `chrome.storage.local` immediately. Read from storage at the start of each handler.

### Anti-Pattern 2: Claude API Call from Content Script

**What:** Calling `fetch("https://api.anthropic.com/...")` directly in the content script.

**Why bad:** LinkedIn's Content-Security-Policy and CORS headers block cross-origin fetch from content scripts. The call will silently fail or throw a network error.

**Instead:** Send profile data to background via `sendMessage`. Background makes the fetch. Background sends result back.

### Anti-Pattern 3: setTimeout for 7-Day Layer 3 Timer

**What:** Using `setTimeout(callback, 7 * 24 * 60 * 60 * 1000)` in the background worker.

**Why bad:** The service worker will terminate long before 7 days. The timer is lost.

**Instead:** `chrome.alarms.create()` — alarms are persisted by the browser and fire reliably even after multiple browser restarts.

### Anti-Pattern 4: DOM Parsing in Background

**What:** Trying to access `document` or read the LinkedIn DOM from background.js.

**Why bad:** Background service workers have no DOM access. `document` is undefined.

**Instead:** All DOM work lives in the content script. Content script extracts and serializes the profile, then sends a plain JSON object to the background.

### Anti-Pattern 5: Synchronous `sendResponse` with Async Work

**What:** Starting an async operation in `onMessage` without returning `true`.

**Why bad:** Chrome closes the message channel after the listener returns synchronously. If you return `undefined`, `sendResponse` called later will fail silently.

**Instead:** Always `return true` from any `onMessage` listener that calls `sendResponse` asynchronously.

---

## Scalability Considerations

This extension is deliberately single-device with no backend. Scalability concerns are bounded.

| Concern | At 100 candidates | At 1,000 candidates | At 10,000 candidates |
|---------|------------------|--------------------|--------------------|
| Storage size | ~200KB — fine | ~2MB — fine | ~20MB — exceeds 10MB limit |
| CSV export speed | Instant | <1s | May lag (JS string concat) |
| Storage reads on popup open | Fast | Fast | Consider pagination |
| chrome.alarms count | Fine | Fine | Chrome limits ~500 alarms |

**Practical ceiling:** A solo recruiter evaluating 10 candidates/day hits the 10MB limit in ~2–3 years. For v1, recommend a "clear old records" feature as a safety valve rather than worrying about the limit now.

---

## Manifest v3 Permissions Required

```json
{
  "manifest_version": 3,
  "permissions": [
    "storage",
    "alarms",
    "notifications",
    "activeTab",
    "scripting"
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
  },
  "options_page": "options.html"
}
```

**Permission notes:**
- `"scripting"` is required if using `chrome.scripting.executeScript()` to inject content script programmatically (alternative to declarative injection via `content_scripts`)
- `"https://api.anthropic.com/*"` in `host_permissions` is required for the background service worker to call the Claude API — without it, `fetch()` to that domain fails
- `"notifications"` requires user permission grant on macOS (system-level, not extension-level)

---

## Sources

- Chrome Extensions documentation — MV3 Service Worker Lifecycle (knowledge cutoff August 2025, HIGH confidence)
- Chrome Extensions documentation — Message Passing (knowledge cutoff August 2025, HIGH confidence)
- Chrome Extensions documentation — chrome.alarms API (knowledge cutoff August 2025, HIGH confidence)
- Chrome Extensions documentation — chrome.storage API (knowledge cutoff August 2025, HIGH confidence)
- Safari Web Extensions documentation — Xcode conversion workflow (knowledge cutoff August 2025, MEDIUM confidence — Safari MV3 support lags Chrome; verify current Safari version support at time of build)
- Mozilla webextension-polyfill — cross-browser namespace compatibility (knowledge cutoff August 2025, HIGH confidence)
- Anthropic Claude API — CORS behavior and fetch compatibility (knowledge cutoff August 2025, HIGH confidence)

**Confidence note:** Web search and WebFetch tools were unavailable during this research session. All findings are based on training knowledge of the WebExtensions MV3 specification, which is stable and well-documented. The core architectural patterns (component isolation, message passing, alarm-based scheduling, CORS constraints) are HIGH confidence. Safari-specific version support details and any Chrome API changes after August 2025 should be verified against official docs before implementation.
