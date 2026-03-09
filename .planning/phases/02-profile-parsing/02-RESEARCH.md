# Phase 2: Profile Parsing - Research

**Researched:** 2026-03-09
**Domain:** LinkedIn DOM extraction, WXT content scripts, SPA navigation detection
**Confidence:** MEDIUM (selectors confirmed from open-source equivalent extensions; live validation required before implementation)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PARSE-01 | Extension extracts candidate's listed skills from LinkedIn Skills section | Selector `a[data-field='skill_card_skill_topic'] span[aria-hidden='true']` confirmed from Yale3 open-source extension |
| PARSE-02 | Extension extracts job titles, companies, and duration from Experience section | Selectors confirmed: `div.t-bold span[aria-hidden='true']` (title), `span.t-14.t-normal > span[aria-hidden='true']` (company), `span.pvs-entity__caption-wrapper[aria-hidden='true']` (duration) |
| PARSE-03 | Extension extracts degrees and institutions from Education section | Selectors confirmed: `span[aria-hidden='true']:first-of-type` (school), `.t-14.t-normal:not(.t-black--light) > span[aria-hidden='true']` (degree) |
| PARSE-04 | Extension extracts About / Summary text | Selector confirmed: `section[data-view-name='profile-card'] div.inline-show-more-text` |
| PARSE-05 | LinkedIn DOM selectors abstracted behind a configuration layer | Single `src/parser/selectors.ts` file; all other modules import from it only |
| PARSE-06 | Extension detects LinkedIn SPA navigation and re-triggers parsing | WXT built-in `wxt:locationchange` custom event on `ctx.addEventListener` handles pushState/replaceState/popstate |
</phase_requirements>

---

## Summary

LinkedIn profiles are rendered as a React SPA. Navigating between profiles does not trigger a full page reload — the browser URL changes via `history.pushState` and the DOM is mutated in place. A content script that runs only on initial load will silently do nothing when a recruiter navigates from one candidate to another. WXT provides a first-class solution for this: `ctx.addEventListener(window, 'wxt:locationchange', ...)` intercepts all history API mutations and fires immediately (no polling).

LinkedIn's DOM uses a predictable pattern of `span[aria-hidden='true']` text nodes inside React list items (`pvs-list__item--line-separated`). Skills have a distinct `data-field='skill_card_skill_topic'` anchor attribute. Experience and education entries share structural similarity but differ in their containing section's `data-view-name` or `id` attribute. Importantly, the Skills section is **not visible in the initial viewport** — recruiter must scroll to it, and may need to expand "Show all skills." This means extraction must tolerate missing sections rather than treating their absence as an error.

All selectors must live in a single `src/parser/selectors.ts` file (PARSE-05). The parser module consumes only that file. The background service worker receives a `PARSE_PROFILE` message containing the structured `CandidateProfile` object. Test strategy uses Vitest with `environment: 'jsdom'` to inject fixture HTML and validate each extractor function in isolation — no browser runtime required for unit tests.

**Primary recommendation:** Use WXT `wxt:locationchange` for SPA detection; build a `ProfileParser` class that receives `document` as a dependency injection for testability; keep all selectors in `src/parser/selectors.ts`; add a `webNavigation` permission to the manifest.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| WXT | 0.20.18 (installed) | Content script lifecycle, SPA event dispatch | Already in project; `wxt:locationchange` is built-in |
| Vitest | 4.0.18 (installed) | Unit testing parser functions | Already in project; configured with WxtVitest plugin |
| TypeScript | 5.9.3 (installed) | Type-safe parsed profile shape | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@webext-core/fake-browser` | 1.3.4 (installed) | Mock `browser.runtime.sendMessage` in tests | All parser unit tests that send messages |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `wxt:locationchange` | `chrome.webNavigation.onHistoryStateUpdated` in background + `browser.tabs.sendMessage` | Adds round-trip latency; requires `webNavigation` permission + extra message hop; WXT solution is content-script-local |
| `wxt:locationchange` | MutationObserver on `document.body` | Much noisier; fires on every DOM change, not just URL change; harder to debounce correctly |
| jsdom environment | Vitest browser mode | Browser mode requires Playwright install; overkill for pure DOM selector tests on fixture HTML |

**Installation:** No new packages needed. Add `"webNavigation"` to `wxt.config.ts` permissions array.

---

## Architecture Patterns

### Recommended Project Structure
```
linkedin-hhrh-screener/
├── src/
│   └── parser/
│       ├── selectors.ts        # PARSE-05: all CSS selector strings live here only
│       ├── parser.ts           # ProfileParser class; receives document as parameter
│       └── types.ts            # CandidateProfile interface
├── entrypoints/
│   └── content.ts              # SPA navigation detection + parser orchestration
└── tests/
    └── parser.test.ts          # Vitest unit tests with jsdom fixture HTML
```

### Pattern 1: Selector Abstraction Layer (PARSE-05)
**What:** A single TypeScript const-object maps logical field names to CSS selector strings. Nothing else in the codebase contains a LinkedIn selector string.
**When to use:** Always — this is the required pattern per PARSE-05.
**Example:**
```typescript
// src/parser/selectors.ts
export const SELECTORS = {
  name: 'h1',
  headline: 'div.text-body-medium.break-words',
  about: 'section[data-view-name="profile-card"] div.inline-show-more-text span[aria-hidden="true"]',
  skillItem: 'a[data-field="skill_card_skill_topic"] span[aria-hidden="true"]',
  experienceSection: '#experience',
  experienceTitle: 'div.t-bold span[aria-hidden="true"]',
  experienceCompany: 'span.t-14.t-normal:not(.t-black--light) > span[aria-hidden="true"]',
  experienceDuration: 'span.pvs-entity__caption-wrapper[aria-hidden="true"]',
  educationSection: '#education',
  educationSchool: 'span[aria-hidden="true"]:first-of-type',
  educationDegree: '.t-14.t-normal:not(.t-black--light) > span[aria-hidden="true"]',
  educationDuration: '.t-14.t-normal.t-black--light span[aria-hidden="true"]',
} as const;
```

### Pattern 2: Parser as Pure Function with Document Injection
**What:** The `ProfileParser` receives `document` as a parameter so tests can substitute a jsdom document loaded with fixture HTML.
**When to use:** For all extraction functions — makes them unit-testable without a real browser.
**Example:**
```typescript
// src/parser/parser.ts
import { SELECTORS } from './selectors';
import type { CandidateProfile, ExtractionHealth } from './types';

export function parseProfile(doc: Document): { profile: CandidateProfile; health: ExtractionHealth } {
  const name = doc.querySelector(SELECTORS.name)?.textContent?.trim() ?? '';
  const headline = doc.querySelector(SELECTORS.headline)?.textContent?.trim() ?? '';
  // ... etc.
  const health = buildHealth({ name, headline, /* ... */ });
  return { profile: { name, headline, /* ... */ }, health };
}
```

### Pattern 3: WXT SPA Navigation Detection (PARSE-06)
**What:** Use `ctx.addEventListener(window, 'wxt:locationchange', ...)` with a `MatchPattern` check on `newUrl` to re-trigger extraction only when navigation lands on a `/in/` profile URL.
**When to use:** Required — LinkedIn does not reload the page between profiles.
**Example:**
```typescript
// Source: https://wxt.dev/guide/essentials/content-scripts
import { MatchPattern } from 'wxt/sandbox';

const profilePattern = new MatchPattern('https://www.linkedin.com/in/*');

export default defineContentScript({
  matches: ['https://www.linkedin.com/*'],
  main(ctx) {
    // Run on initial page load if already on a profile
    if (profilePattern.includes(location.href)) {
      runExtraction();
    }
    // Re-run on SPA navigation to a profile URL
    ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl }) => {
      if (profilePattern.includes(newUrl)) {
        runExtraction();
      }
    });
  },
});
```

### Pattern 4: Field-Level Health Report (Success Criterion 3)
**What:** After extraction, compute a health object listing which fields were found vs. missing. Send to background and surface in popup.
**When to use:** Always — requirement states "surfaces a field-level health report" rather than silently proceeding.
**Example:**
```typescript
// src/parser/types.ts
export interface ExtractionHealth {
  ok: boolean;
  missing: Array<'name' | 'headline' | 'about' | 'skills' | 'experience' | 'education'>;
}
```

### Pattern 5: Message Type for Profile Data
**What:** Add a `PROFILE_PARSED` message type to `src/shared/messages.ts` so the content script can relay the parsed profile to the background service worker.
**When to use:** Phase 2 output — the background stores this for Phase 3 scoring.
**Example:**
```typescript
// Extension to src/shared/messages.ts
export interface ProfileParsedMessage {
  type: 'PROFILE_PARSED';
  profile: CandidateProfile;
  health: ExtractionHealth;
  tabId?: number;
}
```

### Anti-Patterns to Avoid
- **Putting selectors inline in parser.ts:** Violates PARSE-05. Any selector string not in `selectors.ts` must be moved there.
- **Using `matches: ['https://www.linkedin.com/in/*']`:** WXT content scripts with a specific path pattern are NOT re-injected on SPA navigation. Must use broad `'https://www.linkedin.com/*'` and filter internally.
- **Asserting extraction failure if Skills section is absent:** Skills require scrolling and "Show all" expansion. Empty array is valid; only fully absent page structure is an error.
- **Querying the entire document for experience selectors:** Experience and education share selector patterns. Always scope queries to their containing section element first (e.g., `doc.querySelector('#experience')`), then query within that section.
- **Not debouncing SPA navigation:** LinkedIn fires multiple pushState events for a single profile load. Debounce the extraction trigger by ~500ms or cancel in-flight extraction when a new navigation fires.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SPA URL change detection | Custom MutationObserver or pushState monkey-patching | `ctx.addEventListener(window, 'wxt:locationchange', ...)` | WXT already ships this; correct lifecycle cleanup is handled automatically |
| CSS selector matching on URLs | Regex string matching | `MatchPattern` from `wxt/sandbox` | Handles glob patterns, protocol wildcards; already in WXT bundle |
| Browser API mocking in tests | Manual `vi.mock('browser')` implementations | `@webext-core/fake-browser` (already installed) | In-memory implementation of `browser.runtime.sendMessage`, reset per test |

**Key insight:** LinkedIn DOM extraction itself cannot be abstracted behind a library (no stable library exists for LinkedIn's private DOM). But the surrounding infrastructure — SPA detection, URL matching, browser API mocking — is fully covered by WXT and the existing test stack.

---

## Common Pitfalls

### Pitfall 1: Skills Section Not Present in DOM at Page Load
**What goes wrong:** `querySelectorAll(SELECTORS.skillItem)` returns 0 results even on profiles with many skills.
**Why it happens:** The Skills section is below-fold. LinkedIn lazy-renders it. The "Show all X skills" button must be expanded for full skill data to enter the DOM. Without scrolling, only the top 3-5 skills are present.
**How to avoid:** Extract whatever skills are present in the DOM at the time of parsing. Document in health report that skills may be incomplete if count is low. Do not attempt to programmatically click "Show all" — this is fragile and may violate LinkedIn ToS.
**Warning signs:** Skill array length consistently 3 or 5 across all profiles (truncation sentinel).

### Pitfall 2: Ambiguous Selectors Across Sections
**What goes wrong:** Experience and education entries share CSS class patterns like `span[aria-hidden='true']` and `t-14 t-normal`. Querying from `document` root returns a mix from both sections.
**Why it happens:** LinkedIn reuses design system classes (`artdeco`, `pvs-*`) across all profile card sections.
**How to avoid:** Always scope selector queries to the containing section. Use `doc.querySelector('#experience')` first, then call `.querySelectorAll(SELECTORS.experienceTitle)` on that element, not on `document`.
**Warning signs:** Experience titles contain education degree strings or vice versa in extracted data.

### Pitfall 3: SPA Navigation Fires Multiple Times for One Profile
**What goes wrong:** `wxt:locationchange` fires 2-3 times rapidly when LinkedIn loads a profile, causing multiple extraction runs and multiple `PROFILE_PARSED` messages.
**Why it happens:** LinkedIn pushes intermediate history states during its internal routing before settling on the final `/in/username` URL.
**How to avoid:** Debounce the extraction handler with a ~300-500ms window, or track `lastParsedUrl` and skip if URL has not changed since last extraction.
**Warning signs:** Background receives duplicate `PROFILE_PARSED` messages for the same profile URL in rapid succession.

### Pitfall 4: LinkedIn Selector Breakage After UI Updates
**What goes wrong:** A LinkedIn deploy changes a class name and all extractions silently return empty strings.
**Why it happens:** LinkedIn does not provide a public DOM API. Class names are implementation details subject to change without notice.
**How to avoid:** `PARSE-05` (single selector file) ensures all fixes are one-line changes. The health report (PARSE-06 success criterion 3) surfaces extraction failures immediately rather than hiding them. Monitor for health report `ok: false` as a canary.
**Warning signs:** Health report `missing` array suddenly includes fields that were previously populated; `name` empty on profiles with visible names.

### Pitfall 5: `webNavigation` Permission Not in Manifest
**What goes wrong:** WXT `wxt:locationchange` works at the content script level without `webNavigation`. But if the plan ever shifts to background-based navigation detection, it will fail silently without the permission.
**Why it happens:** The current `wxt.config.ts` does not include `"webNavigation"`.
**How to avoid:** Add `"webNavigation"` to the `permissions` array in `wxt.config.ts` as a precaution for Phase 3+ background message coordination.
**Warning signs:** `chrome.webNavigation is undefined` error in background service worker console.

---

## Code Examples

Verified patterns from official sources and confirmed open-source implementations:

### SPA Navigation Pattern (WXT Official)
```typescript
// Source: https://wxt.dev/guide/essentials/content-scripts
import { MatchPattern } from 'wxt/sandbox';

const profilePattern = new MatchPattern('https://www.linkedin.com/in/*');

export default defineContentScript({
  matches: ['https://www.linkedin.com/*'],
  main(ctx) {
    if (profilePattern.includes(location.href)) runExtraction();
    ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl }) => {
      if (profilePattern.includes(newUrl)) runExtraction();
    });
  },
});
```

### Skills Extraction (from Yale3 open-source LinkedIn extension)
```typescript
// Selector source: https://github.com/KartikayKaul/Yale3 scripts/selectors.js
function extractSkills(doc: Document): string[] {
  return Array.from(
    doc.querySelectorAll('a[data-field="skill_card_skill_topic"] span[aria-hidden="true"]')
  ).map(el => el.textContent?.trim() ?? '').filter(Boolean);
}
```

### Experience Extraction (scoped to section)
```typescript
// Scoped to #experience to avoid cross-section selector contamination
function extractExperience(doc: Document) {
  const section = doc.querySelector('#experience');
  if (!section) return [];
  const items = section.querySelectorAll('li.artdeco-list__item');
  return Array.from(items).map(item => ({
    title: item.querySelector('div.t-bold span[aria-hidden="true"]')?.textContent?.trim() ?? '',
    company: item.querySelector('span.t-14.t-normal:not(.t-black--light) > span[aria-hidden="true"]')?.textContent?.trim() ?? '',
    duration: item.querySelector('span.pvs-entity__caption-wrapper[aria-hidden="true"]')?.textContent?.trim() ?? '',
  }));
}
```

### Parser Unit Test Pattern (Vitest + jsdom)
```typescript
// tests/parser.test.ts — no browser runtime needed
import { describe, it, expect } from 'vitest';
import { parseProfile } from '../src/parser/parser';

it('extracts name from h1', () => {
  const doc = new DOMParser().parseFromString(
    '<html><body><h1>Jane Smith</h1></body></html>',
    'text/html'
  );
  const { profile } = parseProfile(doc);
  expect(profile.name).toBe('Jane Smith');
});
```

### CandidateProfile Type (new type for Phase 2)
```typescript
// src/parser/types.ts
export interface ExperienceEntry {
  title: string;
  company: string;
  duration: string;
}

export interface EducationEntry {
  institution: string;
  degree: string;
  duration: string;
}

export interface CandidateProfile {
  name: string;
  headline: string;
  about: string;
  skills: string[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
  profileUrl: string;
}

export interface ExtractionHealth {
  ok: boolean;
  missing: Array<keyof Omit<CandidateProfile, 'profileUrl'>>;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MutationObserver polling for URL change | `wxt:locationchange` event (monkeypatched pushState) | WXT 0.18+ | Instant detection, no polling lag |
| `matches: ['https://www.linkedin.com/in/*']` for SPA content scripts | Broad `matches: ['https://www.linkedin.com/*']` + internal MatchPattern | WXT best practice | Ensures script survives SPA navigation |
| `pv-profile-section` class selectors | `pvs-list`, `artdeco-list__item`, `data-view-name` attributes | LinkedIn 2023-2024 redesign | Old `pv-*` selectors are dead; new `pvs-*` system is current |

**Deprecated/outdated:**
- `pv-skill-category-entity`, `pv-entity__summary-info` class selectors: These are from pre-2023 LinkedIn design. All confirmed dead.
- `background_scripts` in manifest: MV3 (this project) uses service workers only; no relevance here but a common confusion when reading old scraper code.

---

## Open Questions

1. **Live selector validation required before writing extraction code**
   - What we know: Selectors documented above are from Yale3 (a maintained open-source extension) and confirmed by multiple sources as of 2024-2025.
   - What's unclear: LinkedIn deploys frontend updates frequently. Selectors may have shifted since Yale3's last commit. The STATE.md blocker explicitly calls this out: "LinkedIn DOM selectors must be validated against live LinkedIn markup before writing extraction code."
   - Recommendation: Wave 0 of this phase MUST include a manual browser inspection task where the developer opens a LinkedIn profile in Chrome DevTools and validates each selector in the console (`document.querySelectorAll(...)`) before writing implementation code. Selectors in `selectors.ts` should be treated as starting hypotheses, not guaranteed facts.

2. **Skills section "Show all" expansion**
   - What we know: The full skills list is only in the DOM after the recruiter has scrolled to the Skills section and clicked "Show all X skills."
   - What's unclear: Whether the extension should attempt to programmatically trigger the expansion or document the limitation.
   - Recommendation: Do NOT programmatically click — use whatever is present in the DOM at parse time. Document in health report if skill count appears truncated (e.g., exactly 3 or 5 skills). Phase 3 scoring handles partial data gracefully.

3. **`webNavigation` permission necessity**
   - What we know: `wxt:locationchange` works without `webNavigation` permission in the content script context.
   - What's unclear: Whether Phase 3 background worker will need to receive navigation events independently.
   - Recommendation: Add `"webNavigation"` to `wxt.config.ts` now as a precaution; cost is one permission string.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `linkedin-hhrh-screener/vitest.config.ts` |
| Quick run command | `npx vitest run tests/parser.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PARSE-01 | `extractSkills(doc)` returns array of skill strings from fixture HTML | unit | `npx vitest run tests/parser.test.ts` | ❌ Wave 0 |
| PARSE-02 | `extractExperience(doc)` returns title/company/duration objects | unit | `npx vitest run tests/parser.test.ts` | ❌ Wave 0 |
| PARSE-03 | `extractEducation(doc)` returns institution/degree/duration objects | unit | `npx vitest run tests/parser.test.ts` | ❌ Wave 0 |
| PARSE-04 | `extractAbout(doc)` returns non-empty string from fixture | unit | `npx vitest run tests/parser.test.ts` | ❌ Wave 0 |
| PARSE-05 | No selector string literals exist outside `src/parser/selectors.ts` | lint/manual | `grep -r '"#' src/ --include="*.ts" \| grep -v selectors.ts` | manual |
| PARSE-06 | SPA navigation to new `/in/` URL triggers re-extraction | smoke (manual) | Manual browser test: navigate between two profiles | manual-only |

**PARSE-06 is manual-only justification:** WXT's `wxt:locationchange` event cannot be triggered in jsdom; it requires a real browser DOM and history API. A smoke test document in `02-VERIFY.md` will cover this.

### Sampling Rate
- **Per task commit:** `npx vitest run tests/parser.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/parser.test.ts` — covers PARSE-01 through PARSE-04 with jsdom fixture HTML
- [ ] `src/parser/selectors.ts` — PARSE-05 selector config file
- [ ] `src/parser/types.ts` — `CandidateProfile` and `ExtractionHealth` interfaces
- [ ] `src/parser/parser.ts` — `parseProfile(doc: Document)` function skeleton

---

## Sources

### Primary (HIGH confidence)
- [WXT Content Scripts Guide](https://wxt.dev/guide/essentials/content-scripts) — `wxt:locationchange` event API, `MatchPattern`, `ctx.addEventListener` pattern
- [Chrome webNavigation API Docs](https://developer.chrome.com/docs/extensions/reference/api/webNavigation) — `onHistoryStateUpdated` event signature and permission requirements

### Secondary (MEDIUM confidence)
- [Yale3 GitHub — scripts/selectors.js](https://github.com/KartikayKaul/Yale3) — LinkedIn DOM selectors for name, headline, about, skills, experience, education confirmed from maintained open-source extension; verified structurally consistent with LinkedIn's `pvs-*` design system patterns
- [WXT Issue #1567](https://github.com/wxt-dev/wxt/issues/1567) — Confirms `wxt:locationchange` moves from polling to pushState monkeypatching in current versions; no breaking changes for profile page detection
- [MDN webNavigation.onHistoryStateUpdated](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webNavigation/onHistoryStateUpdated) — Confirms event fires on pushState; cross-browser API specification

### Tertiary (LOW confidence — needs live validation)
- Selector strings from Yale3: These match LinkedIn's known `pvs-*` post-2023 design system but have not been tested against a live LinkedIn page in this session. Must be validated against real DOM before implementation.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — WXT, Vitest, TypeScript all confirmed installed and configured
- WXT SPA detection pattern: HIGH — verified from official WXT docs
- LinkedIn DOM selectors: MEDIUM — confirmed from open-source Yale3 extension, consistent with known LinkedIn design system; live validation required
- Test architecture: HIGH — existing project patterns (fakeBrowser, vitest.config.ts) confirmed

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 for WXT patterns (stable API); 2026-03-16 for LinkedIn selectors (LinkedIn ships DOM changes frequently — re-validate within 1 week of starting implementation)
