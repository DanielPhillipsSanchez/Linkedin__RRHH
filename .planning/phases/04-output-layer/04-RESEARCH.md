# Phase 4: Output Layer - Research

**Researched:** 2026-03-10
**Domain:** Message generation (Cortex/Anthropic), popup UI, LinkedIn DOM compose window, CSV export, WXT/MV3 service worker constraints
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MSG-01 | Extension generates a tailored outreach message for Layer 1 candidates (direct/enthusiastic) | `generateOutreachMessage()` + `cortexComplete()` already implemented in `messenger.ts`; TONE_MAP L1 entry exists |
| MSG-02 | Extension generates a tailored outreach message for Layer 2 candidates (exploratory) | TONE_MAP L2 entry in `messenger.ts` already defined |
| MSG-03 | Extension generates a tailored outreach message for Layer 3 candidates (future-opportunity, delayed-contact framing) | TONE_MAP L3 entry in `messenger.ts` already defined |
| MSG-04 | Recruiter can edit the generated message in the extension panel before sending | `<textarea id="message-textarea">` exists in popup HTML; bound in `index.ts` |
| MSG-05 | Extension provides a button that opens LinkedIn's native message compose window with candidate pre-filled | `open-linkedin-btn` handler exists in `popup/index.ts`; uses LinkedIn messaging URL pattern |
| MSG-06 | Sent message text and timestamp are saved to the candidate's local record | `handleSaveMessage()` in `background.ts` writes `messageSentText` + `messageSentAt`; `mark-sent-btn` in popup calls it |
| CSV-01 | Recruiter can export all evaluated candidates to a CSV file | `export-csv-btn` handler in `popup/index.ts` calls `candidatesToCsv` + `downloadCsv` |
| CSV-02 | CSV includes: candidate name, title, LinkedIn URL, tier, match score | All five columns in `HEADERS` constant in `csv.ts` |
| CSV-03 | CSV includes: matched skills and missing skills (comma-separated) per candidate | Columns 6 and 7 in `candidatesToCsv()`; skills joined with `'; '` |
| CSV-04 | CSV includes: evaluation date and "Contact After" date for Layer 3 candidates | Columns 8 and 9 in `candidatesToCsv()`; `contactAfter` is ISO 8601 from `CandidateRecord` |
| CSV-05 | CSV includes: outreach message text that was sent | Column 10: `messageSentText ?? ''` in `candidatesToCsv()` |
</phase_requirements>

---

## Summary

Phase 4 is almost entirely already implemented in the codebase. The full output layer — message generation, message editing UI, LinkedIn compose window opener, "mark as sent" persistence, CSV generation, and CSV download — exists across `src/scorer/messenger.ts`, `src/shared/csv.ts`, `entrypoints/popup/index.ts`, `entrypoints/popup/index.html`, and `entrypoints/background.ts`. The `CandidateRecord` schema in `schema.ts` already has `outreachMessage`, `messageSentAt`, and `messageSentText` fields.

The critical question for the planner is not "how to build" but "what is missing and what must be verified". Three areas are not yet complete: (1) tests for the messenger (`tests/messenger.test.ts` exists but covers only `generateOutreachMessage` — the background handlers `handleGenerateMessage` and `handleSaveMessage` have no direct tests), (2) the popup UI has the message section and CSV button wired but has never had a human verification checkpoint for the full output workflow, and (3) the LinkedIn compose URL pattern used in the popup is a URL-open approach (not DOM injection) that needs validation against LinkedIn's current URL scheme.

The dual-API architecture (Snowflake Cortex as primary, Anthropic direct as fallback via `src/scorer/anthropic.ts`) is partially in place but `messenger.ts` only calls `cortexComplete`. If Cortex credentials are absent, message generation fails. The planner should decide whether to add Anthropic fallback to message generation or simply surface a clear error — both are defensible, but the current code silently returns an error when Cortex creds are missing.

**Primary recommendation:** Phase 4 plans should focus on test coverage of the background handlers, popup integration tests, human checkpoint verification, and validating the LinkedIn compose URL pattern against a live profile. No significant new code is needed — the implementation is substantially complete.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `cortexComplete()` | local module | Generates outreach message text via Snowflake Cortex | Already used in `generateOutreachMessage`; same API as scorer |
| `anthropicComplete()` | local module | Fallback message generation via Claude direct API | `src/scorer/anthropic.ts` exists; already used by `claude.ts` for scoring |
| `browser.downloads` | Platform (MV3) | Service worker CSV download (alternative to anchor-click in content) | Already declared in `wxt.config.ts` permissions |
| `browser.tabs.create` | Platform | Opens LinkedIn compose URL in a new tab | Used in `open-linkedin-btn` handler already |
| `navigator.clipboard` | Platform | Copy message text to clipboard | Used in `copy-msg-btn` handler; available in popup context |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@webext-core/fake-browser` | 1.3.4 | Test browser.* APIs in Vitest | All background handler tests; already in devDependencies |
| `vi.stubGlobal('fetch', ...)` | Vitest built-in | Mock Snowflake/Anthropic fetch calls in tests | Used in `messenger.test.ts` and `scorer.test.ts` |

### NOT in Stack
| Excluded | Why |
|----------|-----|
| DOM injection into LinkedIn compose window | Popup opens a new tab URL; no scripting injection needed for MSG-05 |
| `browser.downloads` API for CSV | CSV download is called from popup context (has DOM access); `downloadCsv()` uses anchor-click pattern which works in popup |
| Any new npm packages | No new dependencies required for Phase 4 |

**No new `npm install` required for Phase 4.**

---

## Architecture Patterns

### Existing File Layout (Phase 4 touches these files only)
```
linkedin-hhrh-screener/
├── entrypoints/
│   ├── background.ts               # handleGenerateMessage, handleSaveMessage — EXISTS, needs test coverage
│   └── popup/
│       ├── index.html              # message-section, export-section — EXISTS, may need UX polish
│       ├── index.ts                # all button handlers — EXISTS, needs integration verification
│       └── style.css               # may need style additions for message section
├── src/
│   ├── scorer/
│   │   ├── messenger.ts            # generateOutreachMessage — EXISTS, COMPLETE
│   │   ├── cortex.ts               # cortexComplete — EXISTS, COMPLETE
│   │   └── anthropic.ts            # anthropicComplete — EXISTS, may add as fallback
│   ├── shared/
│   │   ├── csv.ts                  # candidatesToCsv + downloadCsv — EXISTS, COMPLETE
│   │   └── messages.ts             # GENERATE_MESSAGE, SAVE_MESSAGE types — EXISTS, COMPLETE
│   └── storage/
│       └── schema.ts               # CandidateRecord.messageSentText/At — EXISTS, COMPLETE
└── tests/
    ├── messenger.test.ts           # generateOutreachMessage tests — EXISTS (4 tests)
    ├── background.test.ts          # handleEvaluate tests — EXISTS; ADD handleGenerateMessage + handleSaveMessage
    └── (csv.test.ts)               # MISSING — candidatesToCsv + downloadCsv need unit tests
```

### Pattern 1: GENERATE_MESSAGE Handler (background.ts)
**What:** Already implemented as `handleGenerateMessage(candidateId)`. Reads candidate from storage, calls `generateOutreachMessage`, saves the generated message to the record.
**Current behavior:** Falls back to a minimal CandidateProfile stub if `lastParsedProfile` is null (candidate may have been evaluated in a previous session). This is correct.
**Edge case to test:** What happens when candidateId is stale (candidate deleted, then evaluate again with same session). The handler returns `{ message: '', error: 'Candidate not found' }` — correct.

### Pattern 2: LinkedIn Compose URL (MSG-05)
**What:** `open-linkedin-btn` handler in `popup/index.ts` constructs:
```typescript
const profilePath = new URL(currentProfileUrl).pathname; // e.g. "/in/janesmith"
const msgUrl = `https://www.linkedin.com/messaging/compose/?recipient=${encodeURIComponent(profilePath)}`;
await browser.tabs.create({ url: msgUrl });
```
**Confidence:** MEDIUM. The LinkedIn messaging compose URL pattern (`/messaging/compose/?recipient=`) is well-known but LinkedIn changes their URL scheme occasionally. The `recipient` parameter accepts a profile path, not a numeric member ID — this may or may not work depending on LinkedIn's current implementation.
**Alternative known approach:** `https://www.linkedin.com/messaging/compose/?to=<profileUrl>` also seen in the wild.
**Recommendation:** Keep the current URL approach. If the recipient is not pre-filled when tested manually, the fallback is simply opening `https://www.linkedin.com/messaging/compose/` without a recipient and letting the recruiter search manually. This is still better than nothing and requires no DOM injection (which would require additional content script permissions and is fragile).

### Pattern 3: CSV Download from Popup Context
**What:** `downloadCsv()` in `csv.ts` uses the anchor-click pattern (creates a `<a download>` element, appends to `document.body`, clicks, removes). This pattern works in popup context (popup has a full DOM).
**Why not `browser.downloads`:** The `downloads` permission is declared in `wxt.config.ts` but is unnecessary for the CSV use case when download is triggered from the popup. The anchor-click approach is simpler, no additional message round-trip through background.
**Pitfall:** Do NOT move CSV export to the background service worker — it has no DOM access. If export is ever needed from background context, use `browser.downloads.download({ url: dataUrl, filename })` where `dataUrl` is a `data:text/csv;charset=utf-8,` URI (not a blob URL, which service workers cannot create).

### Pattern 4: Dual AI Backend (Cortex primary, Anthropic fallback)
**What:** The codebase has both `cortexComplete()` (Snowflake) and `anthropicComplete()` (Anthropic direct). Currently `messenger.ts` calls only `cortexComplete()`.
**Current gap:** If Snowflake credentials are not set, `handleGenerateMessage` returns `{ message: '', error: 'No Snowflake credentials — please configure them in Options' }`. The Anthropic fallback in `anthropic.ts` exists but is NOT wired into the messenger.
**Options for Phase 4:**
- Option A (recommended): Keep as-is. Cortex credentials are required for scoring anyway — if Cortex works for scoring, it works for messaging. A clear error is better than silent fallback complexity.
- Option B: Add Anthropic Claude as fallback in `generateOutreachMessage` when Cortex creds are absent. The function already receives `CortexCredentials` — a type change to accept either would be needed.
**Recommendation:** Option A. The planner should document this as a known constraint, not a bug.

### Pattern 5: `handleSaveMessage` — SAVE_MESSAGE Flow
**What:** Already implemented. Popup reads the textarea value and sends `{ type: 'SAVE_MESSAGE', candidateId, messageText }`. Background writes `messageSentText` and `messageSentAt` to the candidate record. The `mark-sent-btn` triggers this.
**Important:** `mark-sent-btn` does NOT automatically trigger the LinkedIn compose window. The recruiter must click "Open LinkedIn Message" separately (MSG-05), write the message there, then come back to the extension and click "Mark as Sent" (MSG-06). This two-step flow is intentional — the message goes into LinkedIn's native UI, NOT sent automatically (per the Out of Scope constraint on auto-send).

### Anti-Patterns to Avoid
- **Using `chrome.scripting.executeScript` to inject the message into LinkedIn's compose textarea:** Fragile, breaks on LinkedIn DOM changes, requires `scripting` permission already declared but not necessary for this use case. The URL pattern is sufficient.
- **Generating the outreach message automatically during EVALUATE:** Requirements say "after scoring, the extension generates..." — this could be interpreted as auto-generate. Do NOT auto-generate on EVALUATE; keep it as a separate explicit "Generate Message" button click. Auto-generation adds latency to EVALUATE and costs API tokens even when the recruiter doesn't want to message.
- **Calling `URL.createObjectURL(blob)` from the service worker:** Service workers cannot create blob URLs. Use the popup's anchor-click pattern (`downloadCsv()` in `csv.ts`) or a `data:` URI with `browser.downloads` if background download is needed.
- **Re-using `currentCandidateId` across popup reloads:** The popup's `currentCandidateId` is an in-memory variable. If the popup is closed and reopened, `currentCandidateId` is null. The "Generate Message" button appears after an EVALUATE in the same session; a history view click cannot re-trigger generation without adding a mechanism to restore the ID. This is a current UX gap but is acceptable for v1.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Message tone logic | Custom if/else tone tree | `TONE_MAP` in `messenger.ts` | Already implemented; Cortex generates the text, tone only sets prompt instructions |
| CSV escaping | Custom replace logic | `escapeCsvField()` in `csv.ts` | Already implemented; handles commas, quotes, and newlines per RFC 4180 |
| Candidate record update | Direct storage.local.set | `saveCandidate(updatedRecord)` from `storage.ts` | Handles index maintenance and overwrites atomically |
| LinkedIn compose window | DOM injection via content script | URL-based `browser.tabs.create` | Simpler, no DOM injection fragility, already implemented |
| API dual-backend routing | New router module | Leave as-is (Cortex-only in messenger) | YAGNI — Option B adds complexity not needed for v1 |

**Key insight:** Every component of Phase 4 is already implemented. The phase work is test coverage, integration verification, and human checkpoint — not new feature implementation.

---

## Common Pitfalls

### Pitfall 1: LinkedIn Compose URL recipient parameter may not pre-fill
**What goes wrong:** `https://www.linkedin.com/messaging/compose/?recipient=/in/username` opens the compose page but does not pre-fill the recipient field because LinkedIn's current URL scheme may use different parameter names or require a numeric member ID instead of a profile path.
**Why it happens:** LinkedIn's messaging compose URL is not documented in any official API. The parameter name and value format is inferred from observation and changes without notice.
**How to avoid:** Test manually on a live LinkedIn profile before the human verification checkpoint. If `recipient=` does not work, try `to=` or simply document that the compose window opens without pre-fill.
**Warning signs:** Compose window opens but the "To:" field is empty. This is a degraded-but-acceptable outcome — recruiter can still search for the person.

### Pitfall 2: `currentCandidateId` is null after popup reopens
**What goes wrong:** Recruiter evaluates candidate, closes popup, reopens popup, tries to generate message — buttons are disabled and no candidateId is set.
**Why it happens:** `currentCandidateId` is a module-level variable in `popup/index.ts`; popup unloads when closed.
**How to avoid:** The history section in the popup (`candidate-list`) shows recent candidates but does not allow re-triggering the message flow. This is a v1 limitation. If the planner wants to address it: add a "Generate Message" button per candidate in the history list (requires candidateId to be passed through). However this may be Phase 5 scope or post-v1. Document as a known limitation.
**Warning signs:** Recruiter reports the "Generate Message" button is not available after reopening the popup.

### Pitfall 3: CSV download fails silently if `document.body` is unavailable
**What goes wrong:** `downloadCsv()` calls `document.body.appendChild(a)` — if called from a context without DOM (e.g., accidentally moved to background), throws `TypeError`.
**Why it happens:** CSV export was correctly placed in popup context, but if refactored to use `browser.downloads`, the blob URL approach won't work in service worker.
**How to avoid:** Keep `downloadCsv()` in popup context only. If background download is ever needed, use `data:text/csv;...` URI with `browser.downloads.download()`.
**Warning signs:** `TypeError: Cannot read property 'appendChild' of null` in service worker console.

### Pitfall 4: `outreachMessage` field vs. `messageSentText` field confusion
**What goes wrong:** `CandidateRecord` has two message fields: `outreachMessage` (the AI-generated draft, saved when GENERATE_MESSAGE fires) and `messageSentText` (the final text the recruiter sent, saved when SAVE_MESSAGE fires). CSV exports `messageSentText`, not `outreachMessage`. A recruiter who generates but never marks as sent will have an empty column in the CSV.
**Why it happens:** Two separate fields with overlapping purpose.
**How to avoid:** The CSV correctly uses `messageSentText ?? ''`. This is the right behavior — only sent messages appear in CSV. Document for the human checkpoint: the recruiter must click "Mark as Sent" for the message to appear in the CSV export.
**Warning signs:** Recruiter reports empty "Outreach Message Sent" column in CSV after generating but not marking sent.

### Pitfall 5: Missing tests for background message handlers
**What goes wrong:** `handleGenerateMessage` and `handleSaveMessage` exist in `background.ts` but `background.test.ts` only tests `validateStoredCredentials` and `handleEvaluate`. If either handler has a bug (e.g., fails when `lastParsedProfile` is null), it will only be caught at the human checkpoint.
**Why it happens:** Tests were written for Phase 3; Phase 4 handlers were added later.
**How to avoid:** Wave 0 of Phase 4 should add unit tests for `handleGenerateMessage` (happy path, Cortex error, candidate not found, rejected tier) and `handleSaveMessage` (happy path, candidate not found).
**Warning signs:** Vitest passes but manual testing reveals message generation errors.

---

## Code Examples

Verified patterns from existing codebase (all code is already in place):

### GENERATE_MESSAGE handler (background.ts lines 166-205)
```typescript
// Source: entrypoints/background.ts — already implemented
export async function handleGenerateMessage(candidateId: string): Promise<GenerateMessageResult> {
  const candidate = await getCandidate(candidateId);
  if (!candidate) return { message: '', error: 'Candidate not found' };
  if (candidate.tier === 'rejected') return { message: '', error: 'No outreach message for rejected candidates' };

  const creds = await getSnowflakeCredentials();
  if (!creds) return { message: '', error: 'No Snowflake credentials — please configure them in Options' };

  // Falls back to minimal profile stub if not in current session
  const stored = getLastParsedProfile();
  const profile: CandidateProfile = stored?.profile ?? {
    name: candidate.name, headline: candidate.linkedinHeadline,
    about: '', skills: candidate.matchedSkills, experience: [], education: [],
    profileUrl: candidate.profileUrl,
  };

  const result = await generateOutreachMessage(creds, profile, candidate.tier as Exclude<...>, ...);
  if (result.message) {
    candidate.outreachMessage = result.message;
    await saveCandidate(candidate);
  }
  return result;
}
```

### SAVE_MESSAGE handler (background.ts lines 207-216)
```typescript
// Source: entrypoints/background.ts — already implemented
export async function handleSaveMessage(candidateId: string, messageText: string): Promise<SaveMessageResult> {
  const candidate = await getCandidate(candidateId);
  if (!candidate) return { saved: false, error: 'Candidate not found' };
  candidate.messageSentText = messageText;
  candidate.messageSentAt = new Date().toISOString();
  await saveCandidate(candidate);
  return { saved: true };
}
```

### LinkedIn compose URL pattern (popup/index.ts lines 206-211)
```typescript
// Source: entrypoints/popup/index.ts — already implemented
document.getElementById('open-linkedin-btn')?.addEventListener('click', async () => {
  if (!currentProfileUrl) return;
  const profilePath = new URL(currentProfileUrl).pathname; // "/in/janesmith"
  const msgUrl = `https://www.linkedin.com/messaging/compose/?recipient=${encodeURIComponent(profilePath)}`;
  await browser.tabs.create({ url: msgUrl });
});
```

### CSV generation (csv.ts)
```typescript
// Source: src/shared/csv.ts — already implemented
// Headers: Name, Title, LinkedIn URL, Tier, Match Score (%), Matched Skills,
//          Missing Skills, Evaluation Date, Contact After, Outreach Message Sent
export function candidatesToCsv(candidates: CandidateRecord[]): string { ... }
export function downloadCsv(csvContent: string, filename: string): void { ... }
// downloadCsv uses anchor-click pattern — POPUP CONTEXT ONLY
```

### Test pattern for background handlers (extend background.test.ts)
```typescript
// Pattern: mirrors handleEvaluate tests in tests/background.test.ts
import { handleGenerateMessage, handleSaveMessage, _setLastParsedProfileForTest } from '../entrypoints/background';
import { saveCandidate, getCandidate, saveSnowflakeCredentials } from '../src/storage/storage';

describe('handleGenerateMessage', () => {
  it('returns error when candidate not found', async () => {
    const result = await handleGenerateMessage('nonexistent-id');
    expect(result.error).toContain('Candidate not found');
  });

  it('returns error when tier is rejected', async () => {
    // saveCandidate with tier 'rejected', then call handleGenerateMessage
    expect(result.error).toContain('No outreach message for rejected candidates');
  });

  it('returns error when no Snowflake credentials', async () => {
    // saveCandidate L1, no credentials — error: 'No Snowflake credentials'
  });

  it('happy path: generates and saves outreach message', async () => {
    // saveCandidate L1, saveSnowflakeCredentials, mock fetch with sfResponse(...)
    // expect result.message to be non-empty, candidate.outreachMessage updated
  });
});

describe('handleSaveMessage', () => {
  it('saves messageSentText and messageSentAt to candidate record', async () => {
    // saveCandidate, then handleSaveMessage, then getCandidate and verify fields
  });
  it('returns error when candidate not found', async () => { ... });
});
```

### CSV unit test pattern (new tests/csv.test.ts)
```typescript
import { candidatesToCsv } from '../src/shared/csv';
import type { CandidateRecord } from '../src/storage/schema';

describe('candidatesToCsv', () => {
  it('produces correct headers', () => {
    const csv = candidatesToCsv([]);
    expect(csv.split('\n')[0]).toContain('Name');
    expect(csv.split('\n')[0]).toContain('Contact After');
  });

  it('Contact After is empty for non-L3 candidates', () => { ... });
  it('Contact After is populated for L3 candidates', () => { ... });
  it('Outreach Message Sent is empty when messageSentText is undefined', () => { ... });
  it('escapes commas in field values', () => { ... });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DOM injection into compose window | URL-based compose window opener | Phase 4 initial impl | No content script permission needed; less fragile |
| Single API backend (Anthropic only) | Dual backend: Cortex primary + Anthropic fallback | Introduced in Phase 3 | `messenger.ts` currently only uses Cortex; Anthropic module exists but unused in messaging |
| Blob URL for CSV download | Anchor-click with `URL.createObjectURL` | Phase 4 initial impl | Works in popup; would fail in service worker — must stay in popup |

**Deprecated/outdated:**
- None specific to Phase 4. All patterns are current.

---

## Open Questions

1. **Should the "Generate Message" button auto-trigger after EVALUATE for non-rejected tiers?**
   - What we know: Current code requires explicit button click. Requirements say "after scoring, the extension generates..." which could imply auto-generation.
   - What's unclear: Whether the recruiter always wants to generate a message (e.g., what if they just want to record the score)?
   - Recommendation: Keep explicit button. Auto-generation adds latency to the evaluate response and charges API tokens even when recruiter only needs the score. Explicit is more predictable.

2. **Does the LinkedIn compose URL pre-fill the recipient correctly?**
   - What we know: URL pattern `https://www.linkedin.com/messaging/compose/?recipient=/in/username` is used in the code. LinkedIn does not document this URL.
   - What's unclear: Whether this works with current LinkedIn's web app routing; whether it requires the recruiter to have LinkedIn Premium; whether the recipient parameter is a profile path or needs to be a member ID.
   - Recommendation: Include a manual verification step in the human checkpoint plan specifically for the compose URL. Have a fallback message in the UI if the compose window opens without pre-fill.

3. **Should message generation fall back to Anthropic direct API when Snowflake credentials are absent?**
   - What we know: `src/scorer/anthropic.ts` has `anthropicComplete()`. `messenger.ts` only calls `cortexComplete()`. If Cortex creds are missing, message generation errors.
   - What's unclear: Whether the project wants Cortex-only or dual-backend for messaging.
   - Recommendation: Cortex-only for v1. The error message is clear. Adding the fallback in v1 adds complexity without clear user demand since scoring also requires Cortex.

4. **History list "Generate Message" from a previous session candidate?**
   - What we know: The history list in the popup shows recent candidates but clicking them does nothing. `currentCandidateId` is only set during an EVALUATE in the current session.
   - What's unclear: Whether recruiters need to re-generate or re-send messages for old candidates.
   - Recommendation: Out of scope for Phase 4. The history list is read-only. Recruiters who need to resend must re-evaluate the candidate (which navigates to the profile first).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `linkedin-hhrh-screener/vitest.config.ts` |
| Quick run command | `cd linkedin-hhrh-screener && npx vitest run tests/messenger.test.ts tests/background.test.ts` |
| Full suite command | `cd linkedin-hhrh-screener && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MSG-01 | generateOutreachMessage with L1 tone returns message text (mocked Cortex) | unit | `npx vitest run tests/messenger.test.ts` | ✅ (exists, covers this) |
| MSG-02 | generateOutreachMessage with L2 tone returns message text | unit | `npx vitest run tests/messenger.test.ts` | ✅ (implicit — same test structure) |
| MSG-03 | generateOutreachMessage with L3 tone returns message text | unit | `npx vitest run tests/messenger.test.ts` | ✅ (implicit) |
| MSG-04 | Textarea is editable; mark-sent captures textarea value | manual | Manual popup test | ❌ manual only |
| MSG-05 | open-linkedin-btn opens new tab with compose URL | manual + unit | Manual; `npx vitest run tests/background.test.ts` (handler only) | ❌ manual only |
| MSG-06 | handleSaveMessage persists messageSentText + messageSentAt | unit | `npx vitest run tests/background.test.ts` | ❌ Wave 0 (handler not yet tested) |
| CSV-01 | export-csv-btn calls candidatesToCsv and triggers download | manual | Manual popup test | ❌ manual only |
| CSV-02 | CSV includes name, title, URL, tier, score columns | unit | `npx vitest run tests/csv.test.ts` | ❌ Wave 0 |
| CSV-03 | CSV includes matched and missing skills columns | unit | `npx vitest run tests/csv.test.ts` | ❌ Wave 0 |
| CSV-04 | Contact After populated for L3; empty for others | unit | `npx vitest run tests/csv.test.ts` | ❌ Wave 0 |
| CSV-05 | Outreach Message Sent column uses messageSentText | unit | `npx vitest run tests/csv.test.ts` | ❌ Wave 0 |
| Full output flow | Evaluate → Generate → Edit → Open LinkedIn → Mark Sent → Export CSV | manual smoke test | Manual — recruiter workflow in Chrome | ❌ manual only |

### Sampling Rate
- **Per task commit:** `cd linkedin-hhrh-screener && npx vitest run tests/messenger.test.ts tests/background.test.ts tests/csv.test.ts`
- **Per wave merge:** `cd linkedin-hhrh-screener && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/background.test.ts` — add `handleGenerateMessage` tests: happy path (mocked Cortex), candidate not found, rejected tier, no credentials
- [ ] `tests/background.test.ts` — add `handleSaveMessage` tests: saves messageSentText + messageSentAt, candidate not found
- [ ] `tests/csv.test.ts` — new file covering CSV-02 through CSV-05: column presence, L3 contactAfter, skills join format, RFC 4180 escaping
- [ ] Export `handleGenerateMessage` and `handleSaveMessage` as named exports in `background.ts` for direct unit testability (same pattern as `handleEvaluate`) — they are already exported as named exports; confirm no change needed

*(Existing test infrastructure covers all other requirements)*

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `entrypoints/background.ts`, `entrypoints/popup/index.ts`, `entrypoints/popup/index.html`, `src/scorer/messenger.ts`, `src/shared/csv.ts`, `src/storage/schema.ts`, `src/scorer/cortex.ts`, `src/scorer/anthropic.ts` — all read directly in this session
- `tests/messenger.test.ts`, `tests/background.test.ts` — read directly; test coverage gaps identified by inspection
- `.planning/REQUIREMENTS.md` — MSG-01 through MSG-06 and CSV-01 through CSV-05 requirements verbatim
- `wxt.config.ts` — `downloads`, `scripting`, `activeTab` permissions already declared

### Secondary (MEDIUM confidence)
- LinkedIn compose URL pattern `https://www.linkedin.com/messaging/compose/?recipient=` — observed in code; not officially documented by LinkedIn; used by multiple third-party extensions per community research; considered MEDIUM confidence due to absence of official docs
- `browser.downloads` API behavior in MV3 service workers vs popup — inferred from Chrome extension architecture (service worker has no DOM; popup has full DOM); MDN/Chrome docs confirm this pattern

### Tertiary (LOW confidence)
- LinkedIn `recipient` parameter accepting profile paths (vs. numeric member IDs) — inferred from code; not validated against live LinkedIn; must be verified at human checkpoint

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all modules exist and are operational from Phase 3
- Architecture: HIGH — all patterns are already in the codebase; no speculative design
- Test gaps: HIGH — gaps identified by direct test file inspection
- LinkedIn compose URL: MEDIUM — not officially documented; needs live validation
- Pitfalls: HIGH — derived from actual code patterns and established MV3 constraints

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (all patterns are stable; LinkedIn URL pattern may change without notice — validate at each human checkpoint)
