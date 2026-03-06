# Phase 1: Foundation - Research

**Researched:** 2026-03-06
**Domain:** WXT browser extension scaffold, chrome.storage schema, MV3 options page, API key management, JD storage, Safari Xcode setup
**Confidence:** HIGH (core MV3 spec stable; WXT verified against npm 0.20.18; Chrome storage API verified against official docs; Safari workflow verified via xcrun tooling documentation)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SET-01 | Recruiter can enter and save their Anthropic Claude API key in the extension options page | Options page entrypoint pattern, chrome.storage.local schema, wxt.config.ts manifest `options_ui` declaration |
| SET-02 | API key is stored exclusively in the background service worker context and never exposed to the content script | MV3 context isolation: key written by options page, read only in background.ts; never relayed to content scripts |
| SET-03 | Recruiter can create, name, and save multiple job descriptions inside the extension | JD data model with `jd:{uuid}` + `jd:index` key schema in chrome.storage.local; options page CRUD UI |
| SET-04 | Recruiter can paste raw JD text into the extension to import it as a saved JD | Same as SET-03 — textarea field in options page JD form captures raw text |
| SET-05 | Recruiter can mark individual skills in a JD as mandatory vs. nice-to-have for weighted scoring | Skills array in JD schema: `{ text: string, weight: "mandatory" | "nice-to-have" }[]` |
| SET-06 | Recruiter can select which saved JD to use for the current evaluation session | `settings:activeJdId` key in chrome.storage.local; JD selector UI in options page |
</phase_requirements>

---

## Summary

Phase 1 builds the loadable extension shell that every subsequent phase depends on. The two primary technical deliverables are: (1) a WXT project generating a valid Chrome MV3 extension with options page, service worker stub, and content script stub; and (2) a `chrome.storage.local` schema covering API key, job descriptions with skill weighting, and active JD selection — all designed to avoid rewrites in later phases.

WXT 0.20.18 is the current release (verified March 2026). The framework auto-generates the manifest from entrypoints discovered in the `entrypoints/` directory, eliminating manual manifest.json maintenance. The options page handles all recruiter-facing configuration: API key entry and validation, JD CRUD, per-skill mandatory/nice-to-have tagging, and active JD selection. The API key is written to `chrome.storage.local` by the options page and read only in the background service worker — it never crosses into content script context. Safari packaging is established in this phase using `wxt build -b safari` + `xcrun safari-web-extension-converter`, not deferred to Phase 6.

The storage schema must encode data minimalism and expiry timestamps from the start — retrofitting GDPR-compatible deletion and storage quota monitoring after Phase 3 has written thousands of candidate records is significantly more work than designing for it now.

**Primary recommendation:** Initialize with `pnpm dlx wxt@latest init`, select Vanilla TypeScript template, configure `wxt.config.ts` with all required permissions and host_permissions, define the storage schema types before writing any UI code, then build the options page UI against that schema.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| WXT | 0.20.18 (latest) | Cross-browser extension build framework | Market leader in 2026, actively maintained (Mar 4 release), 9,200 GitHub stars. Auto-generates manifest from entrypoints, handles HMR, outputs for Chrome and Safari from single codebase. Replaces stalled CRXJS. |
| TypeScript | ^5.4 | Type-safe development | WXT ships first-class TS support. Catches chrome.* API shape mismatches at compile time. Required for maintainable storage schema typing. |
| Vite | ^6 (via WXT) | Bundler | WXT uses Vite under the hood. Do not configure Vite separately — WXT owns it. ESM-first output aligns with MV3 `"type": "module"` service workers. |
| webextension-polyfill | ^0.12 | `browser.*` namespace cross-browser compat | Wraps `chrome.*` in a Promise-based `browser.*` API. WXT includes this; verify WXT version bundles it before adding separately. Enables shared Chrome/Safari code without branching. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/chrome | ^0.0.300+ | TypeScript types for Chrome extension APIs | Install as devDependency. Required for type-safe chrome.storage, chrome.alarms, chrome.notifications access. WXT may include this; check after init. |
| wxt-module-safari-xcode | latest | Automates `xcrun safari-web-extension-converter` post-build | Add to `wxt.config.ts` modules array for Phase 1 Safari setup. Automatically runs converter and configures Xcode project. Requires macOS + Xcode CLI tools. |
| Vitest | ^3 (via WXT plugin) | Unit testing | WXT ships first-class Vitest support via `WxtVitest()` plugin. Uses `@webext-core/fake-browser` for in-memory chrome.* API implementation — no manual mocking needed. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| WXT | Plasmo | Plasmo forces React; CSP conflicts in extension context; larger bundle. Not justified for 5-element UI. |
| WXT | Plain Vite + manifest.json | Requires manual MV3 + Safari adaptation; WXT solves this. |
| WXT | CRXJS | Stalled maintenance as of 2024. |
| Vanilla TS | React | 40KB+ overhead, babel transform, CSP configuration for a UI with ~5 interactive elements. |
| Vanilla TS | Svelte | WXT + Svelte integration less documented; vanilla is simpler at this complexity level. |
| chrome.storage.local | IndexedDB | Overkill. No complex querying needed. storage.local is accessible from all extension contexts. |
| chrome.storage.local | localStorage | Not accessible from MV3 service workers. |

**Installation:**

```bash
# Initialize project
pnpm dlx wxt@latest init
# Select: Vanilla TypeScript template
# Navigate into project
cd linkedin-hhrh-screener

# Runtime dependencies
pnpm add webextension-polyfill

# Dev dependencies (if not auto-included by WXT)
pnpm add -D @types/chrome vitest

# Optional: Safari automation module
pnpm add -D wxt-module-safari-xcode
```

---

## Architecture Patterns

### Recommended Project Structure

```
linkedin-hhrh-screener/
├── entrypoints/
│   ├── background.ts          # Service worker stub (Phase 1: storage helpers only)
│   ├── content.ts             # Content script stub (Phase 1: placeholder only)
│   ├── options/
│   │   ├── index.html         # Options page HTML
│   │   └── index.ts           # Options page TypeScript
│   └── popup/
│       ├── index.html         # Popup HTML stub (Phase 1: link to options only)
│       └── index.ts           # Popup TypeScript stub
├── src/
│   ├── storage/
│   │   ├── schema.ts          # Storage key constants + TypeScript types
│   │   └── storage.ts         # Typed read/write helpers wrapping chrome.storage.local
│   ├── types/
│   │   ├── jd.ts              # JobDescription, Skill types
│   │   └── settings.ts        # Settings types
│   └── shared/
│       └── messages.ts        # Message type enum (for later phases)
├── public/
│   └── icons/                 # Extension icons (16, 32, 48, 128px)
├── wxt.config.ts              # WXT configuration + manifest permissions
├── tsconfig.json              # TypeScript config
└── package.json
```

### Pattern 1: WXT Entrypoint Definitions

WXT discovers entrypoints by scanning the `entrypoints/` directory. File naming conventions drive manifest generation automatically.

**Background service worker:**
```typescript
// entrypoints/background.ts
export default defineBackground(() => {
  console.log('Background service worker initialized');
  // Phase 1: no logic yet — scaffold only
});
```

**Content script stub:**
```typescript
// entrypoints/content.ts
export default defineContentScript({
  matches: ['https://www.linkedin.com/in/*'],
  main() {
    console.log('Content script loaded on LinkedIn profile');
    // Phase 1: scaffold only — extraction in Phase 2
  },
});
```

**Options page (HTML-based entrypoint):**
```
entrypoints/options/index.html   — standard HTML file; WXT registers it in manifest
entrypoints/options/index.ts     — loaded via <script src="./index.ts"> in the HTML
```

No `defineXxx()` wrapper needed for HTML entrypoints. WXT discovers them by filename convention.

### Pattern 2: wxt.config.ts — Permissions and Manifest

```typescript
// wxt.config.ts
import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'LinkedIn HHRR Screener',
    permissions: [
      'storage',
      'alarms',
      'notifications',
      'activeTab',
      'scripting',
      'downloads',
    ],
    host_permissions: [
      'https://www.linkedin.com/*',
      'https://api.anthropic.com/*',
    ],
    options_ui: {
      page: 'options/index.html',
      open_in_tab: true,
    },
  },
  modules: ['wxt-module-safari-xcode'],  // if using safari automation module
  safariXcode: {
    projectName: 'LinkedInHHRRScreener',
    bundleIdentifier: 'com.yourcompany.linkedin-hhrh-screener',
    appCategory: 'public.app-category.productivity',
  },
});
```

**Critical note on `options_ui` vs `options_page`:** Use `options_ui` (not the deprecated `options_page`). Set `open_in_tab: true` to open in a full tab rather than embedded in `chrome://extensions` — better UX for a multi-section settings page. WXT surfaces this via the `manifest.options_ui` field.

### Pattern 3: Storage Schema — Typed Keys

Define all storage keys as constants and pair them with TypeScript interfaces before writing any UI. This prevents key-naming drift across phases.

```typescript
// src/storage/schema.ts

// ---- Key constants ----
export const STORAGE_KEYS = {
  API_KEY: 'settings:apiKey',
  ACTIVE_JD_ID: 'settings:activeJdId',
  DATA_RETENTION_DAYS: 'settings:dataRetentionDays',
  JD_INDEX: 'jd:index',
  jd: (id: string) => `jd:${id}` as const,
  candidate: (id: string) => `candidate:${id}` as const,
  CANDIDATE_INDEX: 'candidate:index',
} as const;

// ---- Type definitions ----

export interface Skill {
  text: string;
  weight: 'mandatory' | 'nice-to-have';
}

export interface JobDescription {
  id: string;               // UUID
  title: string;            // Human-readable name (e.g., "Senior Backend Engineer")
  rawText: string;          // Pasted JD text
  skills: Skill[];          // Parsed + manually tagged skills list
  createdAt: string;        // ISO 8601
  updatedAt: string;        // ISO 8601
}

export interface Settings {
  apiKey?: string;          // Anthropic API key — ONLY read from background service worker
  activeJdId?: string;      // UUID of selected JD
  dataRetentionDays: number; // Default 90 — for GDPR compliance
}

// CandidateRecord defined in Phase 3 — placeholder type for schema completeness
export interface CandidateRecord {
  id: string;
  name: string;
  profileUrl: string;
  linkedinHeadline: string;
  score: number;
  tier: 'L1' | 'L2' | 'L3' | 'rejected';
  matchedSkills: string[];
  missingSkills: string[];
  outreachMessage: string;
  evaluatedAt: string;        // ISO 8601
  contactAfter?: string;      // ISO 8601 — L3 only (evaluatedAt + 7 days)
  jdId: string;               // Which JD was used
  messageSentAt?: string;     // ISO 8601 — populated when recruiter sends
  messageSentText?: string;   // Copy of sent message
  expiresAt: string;          // ISO 8601 — evaluatedAt + dataRetentionDays
}
```

### Pattern 4: Typed Storage Helpers

```typescript
// src/storage/storage.ts
import { STORAGE_KEYS, JobDescription, Settings } from './schema';

// Settings
export async function getApiKey(): Promise<string | undefined> {
  const result = await browser.storage.local.get(STORAGE_KEYS.API_KEY);
  return result[STORAGE_KEYS.API_KEY] as string | undefined;
}

export async function saveApiKey(key: string): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.API_KEY]: key });
}

export async function getActiveJdId(): Promise<string | undefined> {
  const result = await browser.storage.local.get(STORAGE_KEYS.ACTIVE_JD_ID);
  return result[STORAGE_KEYS.ACTIVE_JD_ID] as string | undefined;
}

export async function setActiveJdId(jdId: string): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.ACTIVE_JD_ID]: jdId });
}

// Job Descriptions
export async function getAllJds(): Promise<JobDescription[]> {
  const indexResult = await browser.storage.local.get(STORAGE_KEYS.JD_INDEX);
  const ids: string[] = indexResult[STORAGE_KEYS.JD_INDEX] ?? [];
  if (ids.length === 0) return [];
  const keys = ids.map(STORAGE_KEYS.jd);
  const result = await browser.storage.local.get(keys);
  return keys.map(k => result[k]).filter(Boolean) as JobDescription[];
}

export async function saveJd(jd: JobDescription): Promise<void> {
  const indexResult = await browser.storage.local.get(STORAGE_KEYS.JD_INDEX);
  const ids: string[] = indexResult[STORAGE_KEYS.JD_INDEX] ?? [];
  if (!ids.includes(jd.id)) {
    ids.push(jd.id);
    await browser.storage.local.set({ [STORAGE_KEYS.JD_INDEX]: ids });
  }
  await browser.storage.local.set({ [STORAGE_KEYS.jd(jd.id)]: jd });
}

export async function deleteJd(jdId: string): Promise<void> {
  const indexResult = await browser.storage.local.get(STORAGE_KEYS.JD_INDEX);
  const ids: string[] = indexResult[STORAGE_KEYS.JD_INDEX] ?? [];
  const updated = ids.filter(id => id !== jdId);
  await browser.storage.local.set({ [STORAGE_KEYS.JD_INDEX]: updated });
  await browser.storage.local.remove(STORAGE_KEYS.jd(jdId));
  // If deleted JD was active, clear active selection
  const activeResult = await browser.storage.local.get(STORAGE_KEYS.ACTIVE_JD_ID);
  if (activeResult[STORAGE_KEYS.ACTIVE_JD_ID] === jdId) {
    await browser.storage.local.remove(STORAGE_KEYS.ACTIVE_JD_ID);
  }
}

// Storage quota monitoring
export async function getStorageUsageBytes(): Promise<number> {
  return browser.storage.local.getBytesInUse(null);
}

export const STORAGE_QUOTA_BYTES = 10 * 1024 * 1024; // 10MB
export const STORAGE_WARN_THRESHOLD = 0.8; // Warn at 80%
```

### Pattern 5: API Key Validation via GET /v1/models

Use `GET https://api.anthropic.com/v1/models` as a lightweight key validation endpoint. This call returns model metadata — no tokens consumed, no message generated. A 200 response confirms the key is valid; 401 confirms it is invalid; connection error indicates a network problem.

```typescript
// In background service worker ONLY — never call from options page directly
export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/models?limit=1', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    });
    if (response.ok) return { valid: true };
    if (response.status === 401) return { valid: false, error: 'Invalid API key' };
    return { valid: false, error: `Unexpected status: ${response.status}` };
  } catch (err) {
    return { valid: false, error: 'Network error — check your connection' };
  }
}
```

**How options page triggers this:** Options page sends a message to background via `browser.runtime.sendMessage({ type: 'VALIDATE_API_KEY', key })`. Background validates and responds. The key is never passed back to the options page after save — only validation status is returned.

### Pattern 6: Safari Build Workflow

Two approaches; the module approach is preferred for automation:

**Approach A — Manual (always works):**
```bash
pnpm wxt build -b safari
xcrun safari-web-extension-converter .output/safari-mv3 \
  --project-location ./safari-extension \
  --app-name "LinkedIn HHRR Screener" \
  --bundle-identifier com.yourcompany.linkedin-hhrh-screener \
  --swift \
  --force
```

**Approach B — Automated via `wxt-module-safari-xcode` (preferred):**
```typescript
// wxt.config.ts
modules: ['wxt-module-safari-xcode'],
safariXcode: {
  projectName: 'LinkedInHHRRScreener',
  bundleIdentifier: 'com.yourcompany.linkedin-hhrh-screener',
  appCategory: 'public.app-category.productivity',
},
```
Then: `pnpm wxt build -b safari` — Xcode project auto-generated at `.output/LinkedInHHRRScreener/`.

**Commit the Xcode project to version control immediately.** The converter is destructive on re-run; having the project in git allows diffing what changed between builds.

### Anti-Patterns to Avoid

- **API key in options page fetch:** Options page must not call the Anthropic API directly. It saves the key to storage and sends a validation message to background. Background does the fetch. Key never leaves background context after save.
- **`options_page` in manifest (deprecated):** Use `options_ui` with `open_in_tab: true`. `options_page` is ignored when `options_ui` is present.
- **Inline `<script>` tags in HTML entrypoints:** MV3 CSP blocks inline scripts. All JS must be in external files loaded via `<script src="...">`. WXT enforces this by default.
- **`chrome.*` namespace without polyfill:** Use `browser.*` from `webextension-polyfill` throughout. This is what makes the Safari port work without code branching.
- **Safari setup deferred:** The Xcode project must exist in the repo by end of Phase 1. Deferring to Phase 6 adds 1-2 weeks of surprise work when Safari-specific API gaps are discovered late.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Manifest generation | Custom manifest.json | WXT entrypoint conventions | WXT auto-generates manifest from entrypoints; manual manifest requires re-sync on every change |
| Cross-browser API compatibility | `if (chrome) ... else if (browser) ...` branching | `webextension-polyfill` | Browser namespace differences are subtle and cumulative; the polyfill handles 100+ edge cases |
| Chrome.* API mocking in tests | Manual `vi.mock('chrome')` | WXT Vitest plugin + `@webext-core/fake-browser` | Fake browser implements storage in-memory; no mock setup needed; `fakeBrowser.reset()` between tests |
| UUID generation | Custom UUID function | `crypto.randomUUID()` | Available natively in all MV3 contexts (service worker, options page, popup). No library needed. |
| Safari Xcode project creation | Manual Xcode project setup | `xcrun safari-web-extension-converter` or `wxt-module-safari-xcode` | Converter handles entitlements, Info.plist, and project structure; hand-rolling Xcode project for an extension is error-prone |

**Key insight:** WXT's entrypoint convention system eliminates an entire class of manifest synchronization bugs. The single largest source of MV3 extension breakage in development is manifest.json getting out of sync with actual files. WXT removes this failure mode entirely.

---

## Common Pitfalls

### Pitfall 1: API Key Accessible Outside Background Context

**What goes wrong:** Developer reads `browser.storage.local.get('settings:apiKey')` in the options page to pre-fill the input, then the key is visible in the options page JS context — which is a web page context accessible to any XSS on that origin.

**Why it happens:** Options page legitimately writes the key; it seems natural to also read it for display.

**How to avoid:** Never pre-fill the API key input with the stored value. Use a placeholder like `"••••••••"` if a key is saved. The options page can check `storage.local.has(KEY)` (or get and check `!== undefined`) to show a "key saved" indicator without reading the actual value into a DOM element.

**Warning signs:** `browser.storage.local.get('settings:apiKey')` exists outside `entrypoints/background.ts`.

### Pitfall 2: `options_ui` vs `options_page` Confusion

**What goes wrong:** Developer sets `options_page` in manifest (deprecated in MV3). Chrome silently ignores it if `options_ui` is also present; WXT may handle this differently per version.

**How to avoid:** Use only `options_ui` in `wxt.config.ts`. Set `open_in_tab: true` for a full-tab options experience rather than the cramped embedded chrome://extensions panel.

### Pitfall 3: Safari Build Output Path Mismatch

**What goes wrong:** `xcrun safari-web-extension-converter` is run against the wrong directory. WXT outputs Chrome MV3 to `.output/chrome-mv3/` and Safari to `.output/safari-mv3/`. Running the converter against the Chrome output still works (same file structure) but produces a Safari extension that has Chrome-target optimizations rather than Safari-target ones.

**How to avoid:** Always build with `pnpm wxt build -b safari` before running the converter, or use the `wxt-module-safari-xcode` module which handles this automatically.

### Pitfall 4: Storage Schema Written Without Expiry Timestamps

**What goes wrong:** `CandidateRecord` schema is defined without `expiresAt`. GDPR-compliant deletion must be retroactively applied to all existing records — every record must be rewritten with the new field after it is added.

**How to avoid:** Include `expiresAt: string` (ISO 8601) in `CandidateRecord` from Phase 1. Set it to `evaluatedAt + dataRetentionDays * 86400000`. The cleanup job in Phase 5 then only needs to filter on `expiresAt < now`.

### Pitfall 5: Missing `return true` in async `onMessage` listeners

**What goes wrong:** Background service worker starts an async operation in `onMessage` without returning `true`. Chrome closes the message channel synchronously after the listener returns. When `sendResponse` is called later (after the async operation), it silently fails. This particularly affects API key validation where the options page waits for a `VALIDATE_API_KEY_RESULT` message.

**How to avoid:** Every `onMessage` listener that uses `sendResponse` asynchronously must explicitly `return true` before any `await`. This is established as the background stub pattern in Phase 1 so all future phases inherit it.

```typescript
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'VALIDATE_API_KEY') {
    validateApiKey(message.key).then(result => sendResponse(result));
    return true; // CRITICAL — keep channel open
  }
});
```

### Pitfall 6: Content Script Receiving the API Key

**What goes wrong:** When `sendMessage` broadcasts from background, any listener in any context (including content scripts) can receive it. If the API key is ever sent in a message payload, content scripts on LinkedIn receive it.

**How to avoid:** The API key must never appear in any message payload. The background `VALIDATE_API_KEY` response is `{ valid: boolean, error?: string }` — not the key. Storage writes are direct to `chrome.storage.local`, not broadcast.

---

## Code Examples

### Options Page: JD Skill Editor Pattern

```typescript
// entrypoints/options/index.ts
import { saveJd, getAllJds, deleteJd, setActiveJdId, getActiveJdId } from '../../src/storage/storage';
import type { JobDescription, Skill } from '../../src/storage/schema';

function renderSkillList(skills: Skill[], container: HTMLElement): void {
  container.innerHTML = '';
  skills.forEach((skill, i) => {
    const row = document.createElement('div');
    row.className = 'skill-row';
    row.innerHTML = `
      <span class="skill-text">${skill.text}</span>
      <label>
        <input type="radio" name="skill-${i}-weight" value="mandatory"
          ${skill.weight === 'mandatory' ? 'checked' : ''}> Mandatory
      </label>
      <label>
        <input type="radio" name="skill-${i}-weight" value="nice-to-have"
          ${skill.weight === 'nice-to-have' ? 'checked' : ''}> Nice-to-have
      </label>
      <button data-delete-skill="${i}">Remove</button>
    `;
    container.appendChild(row);
  });
}

async function saveJdForm(form: HTMLFormElement, skills: Skill[]): Promise<void> {
  const title = (form.querySelector('#jd-title') as HTMLInputElement).value.trim();
  const rawText = (form.querySelector('#jd-raw-text') as HTMLTextAreaElement).value.trim();
  if (!title || !rawText) return;

  const jd: JobDescription = {
    id: crypto.randomUUID(),
    title,
    rawText,
    skills,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await saveJd(jd);
}
```

### API Key Save + Validate (Options Page Side)

```typescript
// In entrypoints/options/index.ts

async function handleApiKeySave(keyInput: HTMLInputElement, statusEl: HTMLElement): Promise<void> {
  const key = keyInput.value.trim();
  if (!key) return;

  // Save to storage — options page CAN write, background reads
  await browser.storage.local.set({ 'settings:apiKey': key });
  statusEl.textContent = 'Validating...';

  // Delegate validation to background service worker
  const result = await browser.runtime.sendMessage({ type: 'VALIDATE_API_KEY' });
  if (result.valid) {
    statusEl.textContent = 'API key saved and validated';
    keyInput.value = ''; // Clear input — never display stored key
  } else {
    statusEl.textContent = `Validation failed: ${result.error}`;
  }
}
```

### Background: Validation Handler (Service Worker)

```typescript
// entrypoints/background.ts
import { getApiKey } from '../src/storage/storage';

async function validateStoredApiKey(): Promise<{ valid: boolean; error?: string }> {
  const apiKey = await getApiKey();
  if (!apiKey) return { valid: false, error: 'No API key stored' };

  try {
    const response = await fetch('https://api.anthropic.com/v1/models?limit=1', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    });
    if (response.ok) return { valid: true };
    if (response.status === 401) return { valid: false, error: 'Invalid API key' };
    return { valid: false, error: `HTTP ${response.status}` };
  } catch {
    return { valid: false, error: 'Network error' };
  }
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'VALIDATE_API_KEY') {
      validateStoredApiKey().then(sendResponse);
      return true; // keep channel open for async response
    }
  });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CRXJS (Vite plugin for extensions) | WXT 0.20.x | 2023–2024 | WXT absorbed CRXJS ideas with active maintenance; CRXJS stalled |
| Manual manifest.json + webpack | WXT entrypoint conventions | 2023 | Manifest sync bugs eliminated; HMR built-in |
| MV2 background pages (persistent) | MV3 service workers (event-driven) | Chrome 112+ enforced | No persistent in-memory state; must use chrome.storage for all state; chrome.alarms for scheduling |
| `chrome.*` namespace directly | `browser.*` via webextension-polyfill | Ongoing | Safari compatibility without code branching |
| `options_page` manifest key | `options_ui` with `open_in_tab` | MV3 | `options_page` deprecated; `options_ui` is the current standard |
| Manual Xcode project for Safari | `xcrun safari-web-extension-converter` + `wxt-module-safari-xcode` | macOS Monterey+ | Automated conversion from Chrome build; no manual Xcode project setup |

**Deprecated/outdated:**
- `options_page` manifest key: deprecated, ignored when `options_ui` is present
- `chrome.storage.local` default quota of 5MB: raised to 10MB in Chrome 113+
- MV2 background scripts: Chrome has enforced MV3 for new extensions since January 2023; existing MV2 extensions disabled in Chrome 127+ (June 2024)

---

## Validation Architecture

> `nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^3 via WXT Vitest plugin |
| Config file | `vitest.config.ts` (to be created in Wave 0) |
| Quick run command | `pnpm vitest run --reporter=verbose` |
| Full suite command | `pnpm vitest run` |

**Setup note:** WXT's Vitest plugin requires `WxtVitest()` in the vitest config and uses `@webext-core/fake-browser` for all `browser.*` API calls. No manual chrome.* mocking required. Run `fakeBrowser.reset()` in `afterEach`.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SET-01 | `saveApiKey()` writes to storage | unit | `pnpm vitest run tests/storage.test.ts -t "saveApiKey"` | Wave 0 |
| SET-01 | Options page UI: key input saves to storage | manual | Manual — browser UI | N/A |
| SET-02 | API key never in content script context | manual | Code review + grep for `getApiKey` outside background.ts | N/A |
| SET-02 | `validateStoredApiKey()` reads key, returns status | unit | `pnpm vitest run tests/background.test.ts -t "validateStoredApiKey"` | Wave 0 |
| SET-03 | `saveJd()` writes JD + updates index | unit | `pnpm vitest run tests/storage.test.ts -t "saveJd"` | Wave 0 |
| SET-03 | `getAllJds()` returns all saved JDs in order | unit | `pnpm vitest run tests/storage.test.ts -t "getAllJds"` | Wave 0 |
| SET-04 | `saveJd()` with rawText field preserves text | unit | `pnpm vitest run tests/storage.test.ts -t "saveJd rawText"` | Wave 0 |
| SET-05 | Skill weight `mandatory`/`nice-to-have` persists | unit | `pnpm vitest run tests/storage.test.ts -t "skill weight"` | Wave 0 |
| SET-06 | `setActiveJdId()` persists; `getActiveJdId()` retrieves | unit | `pnpm vitest run tests/storage.test.ts -t "activeJdId"` | Wave 0 |
| SET-06 | `deleteJd()` clears activeJdId if deleted JD was active | unit | `pnpm vitest run tests/storage.test.ts -t "deleteJd clears active"` | Wave 0 |

**Manual-only items:**
- Extension loading in Chrome developer mode (requires browser)
- Options page rendering and form submission (browser UI)
- API key validation end-to-end (requires real Anthropic API key)
- Safari loading via Xcode (requires macOS + Xcode)

### Sampling Rate

- **Per task commit:** `pnpm vitest run tests/storage.test.ts`
- **Per wave merge:** `pnpm vitest run`
- **Phase gate:** All unit tests green + manual checklist complete before proceeding to Phase 2

### Wave 0 Gaps

- [ ] `tests/storage.test.ts` — covers SET-01, SET-03, SET-04, SET-05, SET-06 storage operations
- [ ] `tests/background.test.ts` — covers SET-02 background validation handler
- [ ] `vitest.config.ts` — WXT Vitest plugin setup with fake-browser
- [ ] Framework install: `pnpm add -D vitest @webext-core/fake-browser` (if not bundled by WXT)

---

## Open Questions

1. **`wxt-module-safari-xcode` maturity**
   - What we know: Module exists on npm, automates `xcrun safari-web-extension-converter` per its README
   - What's unclear: Whether it handles WXT 0.20.x cleanly without configuration issues; how it handles re-runs when the Xcode project already exists
   - Recommendation: Verify module version compatibility with WXT 0.20.x before adding to the project. Fallback is the two-command manual approach which is always reliable.

2. **WXT and `webextension-polyfill` bundling**
   - What we know: WXT documentation states it includes the polyfill; older versions required manual install
   - What's unclear: Whether WXT 0.20.18 bundles `webextension-polyfill` automatically or requires explicit `pnpm add webextension-polyfill`
   - Recommendation: After `pnpm dlx wxt@latest init`, check `package.json` for `webextension-polyfill` before adding it manually to avoid double-bundling.

3. **`@types/chrome` in WXT projects**
   - What we know: WXT provides `@wxt-dev/browser` type package as of recent releases
   - What's unclear: Whether `@wxt-dev/browser` fully replaces `@types/chrome` or both are needed
   - Recommendation: After init, check `.wxt/types/` for generated chrome type declarations. Only add `@types/chrome` if WXT's generated types are incomplete.

4. **Anthropic API key format validation (client-side)**
   - What we know: Anthropic keys begin with `sk-ant-`; length is fixed
   - What's unclear: Whether this format is documented and stable as of 2026
   - Recommendation: Add a lightweight regex pre-check (`/^sk-ant-/.test(key)`) before sending the validation message to background, to catch obvious typos before making a network call. Do not rely on format alone — always do the live validation ping.

---

## Sources

### Primary (HIGH confidence)

- WXT official docs — https://wxt.dev/guide/essentials/entrypoints.html — entrypoint definitions, project structure, manifest configuration
- WXT official docs — https://wxt.dev/guide/essentials/config/manifest — permissions, host_permissions, options_ui configuration
- WXT official docs — https://wxt.dev/guide/essentials/unit-testing — Vitest plugin, fake-browser setup
- Chrome storage API — https://developer.chrome.com/docs/extensions/reference/api/storage — storage areas, quota limits (10MB confirmed for Chrome 113+), getBytesInUse
- Anthropic API — https://platform.claude.com/docs/en/api/models-list — GET /v1/models endpoint for key validation (no tokens consumed)

### Secondary (MEDIUM confidence)

- WXT npm — version 0.20.18 confirmed as latest, last published 3 days ago (verified 2026-03-06)
- `wxt-module-safari-xcode` npm/GitHub — automates xcrun safari-web-extension-converter; requires further version compat verification
- MDN — `options_ui` vs `options_page` distinction confirmed; `options_page` deprecated in favor of `options_ui`
- WebSearch cross-referenced: WXT Safari build command `pnpm wxt build -b safari` confirmed by multiple community sources

### Tertiary (LOW confidence — verify before use)

- `wxt-module-safari-xcode` behavior with WXT 0.20.x — single source (GitHub README); verify with test build before committing to approach
- Anthropic API key format `sk-ant-*` — inferred from observed examples; not in official docs; use as soft pre-validation only

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — WXT 0.20.18 verified on npm; Chrome storage API verified on official docs; Anthropic validation endpoint verified on official API docs
- Architecture: HIGH — MV3 entrypoint isolation, message passing patterns, options_ui manifest key, storage schema design are well-documented stable patterns
- Safari workflow: MEDIUM — xcrun converter workflow documented and stable since Monterey; `wxt-module-safari-xcode` module is newer and should be verified before use
- Pitfalls: HIGH — all pitfalls directly derived from MV3 specification constraints and verified storage API behavior

**Research date:** 2026-03-06
**Valid until:** 2026-06-06 (90 days — WXT releases frequently; re-verify version before pinning in package.json)
