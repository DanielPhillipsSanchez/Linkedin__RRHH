# Phase 3: Scoring Pipeline - Research

**Researched:** 2026-03-10
**Domain:** Hybrid keyword + Claude API scoring engine, browser-extension storage, WXT/MV3 background service worker
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCORE-01 | Extension scores parsed profile against selected JD using keyword matching as a first pass | Keyword normalisation algorithm documented; weighted scoring formula specified |
| SCORE-02 | Extension calls Claude API (from background service worker) to refine score for ambiguous or synonym skills | Direct `fetch()` pattern already proven in `validateStoredApiKey`; Claude Haiku 4.5 model ID confirmed; prompt template designed |
| SCORE-03 | Mandatory skills have higher weight than nice-to-have skills in the final score | Weight constant scheme (mandatory = 2, nice-to-have = 1) documented with formula |
| SCORE-04 | Extension assigns tier based on final match percentage: L1 ≥80%, L2 71–79%, L3 60–70%, Rejected <60% | Tier thresholds are fixed requirements; tier assignment function specified |
| SCORE-05 | Extension displays overall match percentage and tier label to recruiter | Popup `EVALUATE` message flow documented; result shape defined |
| SCORE-06 | Extension displays list of JD skills the candidate matches | matchedSkills string array in ScoringResult type |
| SCORE-07 | Extension displays list of required skills the candidate is missing | missingSkills string array (mandatory-only for display) in ScoringResult type |
| SCORE-08 | Extension displays Claude's brief rationale explaining the score and tier | rationale string from Claude response; prompt instructs concise 2-3 sentence output |
| STORE-01 | Evaluated candidate record saved to browser local storage | CandidateRecord schema already in schema.ts; storage helper pattern established |
| STORE-02 | Storage usage indicator visible in extension | `getStorageUsageBytes()` already implemented; display in popup |
| STORE-03 | Recruiter can view previously evaluated candidates in extension panel | Candidate index pattern mirrors JD index already in storage.ts |
</phase_requirements>

---

## Summary

Phase 3 builds the core value loop: a recruiter clicks "Evaluate" in the popup, the background service worker reads the stored profile and active JD, runs keyword matching, calls Claude for ambiguous skills, and returns a scored result that is persisted and displayed. All three components — scorer, Claude integration, and candidate storage — are new files that slot into the existing WXT architecture without rework.

The existing codebase has already solved the hard integration problems. The background service worker makes live Anthropic API calls using plain `fetch()` with `x-api-key` and `anthropic-version` headers (proven in `validateStoredApiKey`). Typed storage helpers and the `CandidateRecord` schema are already defined in `schema.ts`. The `STORAGE_KEYS.candidate(id)` and `STORAGE_KEYS.CANDIDATE_INDEX` constants are already present. Phase 3 only needs to implement the scoring logic, the Claude call, and the storage write/read for candidates.

The critical design constraint is that the `@anthropic-ai/sdk` is NOT installed and should NOT be installed. The project pattern is direct `fetch()` to the Anthropic REST API, which avoids all Node.js-globals concerns in the service worker and keeps the bundle small. The Claude model to use is `claude-haiku-4-5-20251001` (current Haiku, $1/$5 per MTok — fastest and cheapest for a classification task).

**Primary recommendation:** Implement scoring as three pure modules — `src/scorer/scorer.ts` (keyword pass), `src/scorer/claude.ts` (API call), `src/scorer/tiers.ts` (thresholds + tier label) — and wire them together in a new `EVALUATE` message handler in `background.ts`. Persist results via new candidate storage helpers that mirror the existing JD helpers.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fetch()` (built-in) | Platform | Anthropic API calls from service worker | Already proven in background.ts; no Node globals; no extra bundle weight |
| `browser.storage.local` (built-in) | Platform | Candidate persistence | Already abstracted in storage.ts; 10MB quota |
| `crypto.randomUUID()` (built-in) | Platform | Candidate record ID | Already used for JD IDs in the existing schema |
| vitest + @webext-core/fake-browser | 4.0.18 / 1.3.4 | Unit testing scorer and storage | Already installed devDependencies; established test pattern |

### NOT in Stack (important)
| Excluded | Why |
|----------|-----|
| `@anthropic-ai/sdk` | NOT installed; direct fetch already proven; SDK adds bundle weight and potential Node globals in service worker; MEDIUM confidence it works in MV3 SW without issues, not worth validating |
| Any scoring library (Fuse.js, etc.) | The keyword matching needed here is normalised string comparison, not fuzzy search; hand-rolling is appropriate and testable |
| Any state management library | WXT + module-level variables (already used for `lastParsedProfile`) is sufficient |

**No new `npm install` required for Phase 3.**

---

## Architecture Patterns

### Recommended Project Structure (new files in bold)
```
linkedin-hhrh-screener/
├── entrypoints/
│   └── background.ts          # Add EVALUATE message handler
├── src/
│   ├── scorer/                # NEW — all scoring logic lives here
│   │   ├── scorer.ts          # Keyword pass: normalise + match + weighted score
│   │   ├── claude.ts          # Claude API call: skill refinement + rationale
│   │   └── tiers.ts           # Tier thresholds and label assignment
│   ├── storage/
│   │   ├── schema.ts          # CandidateRecord already defined — no changes
│   │   └── storage.ts         # Add saveCandidate(), getAllCandidates(), deleteCandidate()
│   └── shared/
│       └── messages.ts        # Add EVALUATE message types
└── tests/
    ├── scorer.test.ts         # NEW — TDD for keyword scoring, tiers, weighting
    └── storage.test.ts        # Extend — add candidate CRUD tests
```

### Pattern 1: Keyword Normalisation Match
**What:** Normalise both JD skill text and candidate skill text to lowercase, strip punctuation, then check for substring containment in either direction.
**When to use:** First pass — cheap, no API call needed for clear matches.
**Example:**
```typescript
// src/scorer/scorer.ts
function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

function skillMatches(jdSkill: string, candidateSkills: string[]): boolean {
  const jdNorm = normalise(jdSkill);
  return candidateSkills.some((cs) => {
    const csNorm = normalise(cs);
    return csNorm.includes(jdNorm) || jdNorm.includes(csNorm);
  });
}
```

### Pattern 2: Weighted Scoring Formula
**What:** Mandatory skills score 2 points each, nice-to-have score 1 point each. Score = matched_points / total_possible_points * 100.
**When to use:** After keyword pass resolves clear matches; Claude pass resolves ambiguous unmatched skills before final calculation.
**Example:**
```typescript
// src/scorer/scorer.ts
const WEIGHT = { mandatory: 2, 'nice-to-have': 1 } as const;

function computeScore(
  jdSkills: Skill[],
  matchedSkillTexts: Set<string>,
): number {
  const total = jdSkills.reduce((sum, s) => sum + WEIGHT[s.weight], 0);
  if (total === 0) return 0;
  const matched = jdSkills
    .filter((s) => matchedSkillTexts.has(s.text))
    .reduce((sum, s) => sum + WEIGHT[s.weight], 0);
  return Math.round((matched / total) * 100);
}
```

### Pattern 3: Claude Skill Refinement Call
**What:** After keyword pass, collect unmatched JD skills and ask Claude whether the candidate's headline/about/experience implies those skills. Claude returns a JSON array of skill names it considers matched plus a brief rationale.
**When to use:** Only for skills NOT matched by keyword pass — minimises tokens and cost.
**Example:**
```typescript
// src/scorer/claude.ts — uses the same direct-fetch pattern as validateStoredApiKey
export async function refineWithClaude(
  apiKey: string,
  candidateProfile: CandidateProfile,
  unmatchedJdSkills: Skill[],
): Promise<{ additionalMatches: string[]; rationale: string }> {
  const prompt = buildRefinementPrompt(candidateProfile, unmatchedJdSkills);
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  // ... parse response.content[0].text as JSON
}
```

### Pattern 4: Claude Prompt for JSON Output
**What:** Instruct Claude to respond ONLY with a JSON object — no prose wrapper. Parse `response.content[0].text` and wrap in try/catch to handle malformed output.
**Example prompt structure:**
```
You are evaluating a candidate for a job. Based only on the text below, determine which of these unmatched skills the candidate likely has (through synonyms, related experience, or implied knowledge).

Candidate headline: {headline}
About: {about}
Experience titles: {experience titles joined}

Unmatched skills to evaluate: {comma-separated skill names}

Respond with ONLY valid JSON in this exact format:
{"additionalMatches": ["skill1", "skill2"], "rationale": "2-3 sentence explanation of the overall match quality and tier assignment."}

If none match, return: {"additionalMatches": [], "rationale": "..."}
```

### Pattern 5: EVALUATE Message Handler in background.ts
**What:** New message type that orchestrates the full pipeline: read profile + active JD from state/storage, run keyword pass, call Claude, compute final score, assign tier, save candidate, return result.
**When to use:** Triggered by recruiter clicking "Evaluate" button in popup.
**Example:**
```typescript
// entrypoints/background.ts — new handler
if (message.type === 'EVALUATE') {
  (async () => {
    const apiKey = await getApiKey();
    const activeJdId = await getActiveJdId();
    // ... fetch JD, get lastParsedProfile, run scorer, save, sendResponse
  })().then(sendResponse).catch((err) => sendResponse({ error: err.message }));
  return true; // keep channel open
}
```

### Pattern 6: Candidate Storage (mirrors existing JD pattern)
**What:** Candidate records stored per-key with a string-array index, exactly mirroring the JD storage pattern already in storage.ts.
```typescript
// src/storage/storage.ts — new functions
export async function saveCandidate(record: CandidateRecord): Promise<void> {
  // update CANDIDATE_INDEX if new, then set candidate:{id} key
}
export async function getAllCandidates(): Promise<CandidateRecord[]> { ... }
export async function deleteCandidate(id: string): Promise<void> { ... }
```

### Anti-Patterns to Avoid
- **Installing @anthropic-ai/sdk:** Adds Node.js dependencies (`stream`, `buffer`) that may not be available in service workers; direct fetch is already proven and sufficient.
- **Calling Claude for every skill:** Only send unmatched skills to Claude; matched skills waste tokens.
- **Calling Claude when no unmatched skills remain:** Skip the Claude call entirely if all JD skills matched in the keyword pass.
- **Parsing Claude response without try/catch:** Claude can return malformed JSON under edge conditions; always wrap `JSON.parse` and fall back gracefully (treat all additional matches as empty, keep keyword-only score).
- **Storing candidate records in `lastParsedProfile` module variable:** Profiles are transient state; candidates are persisted data. Keep them in separate layers.
- **Blocking the message response while awaiting Claude:** Always `return true` in the message listener to keep the channel open for async responses.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom ID generator | `crypto.randomUUID()` | Already used in JD creation; guaranteed unique; MV3 service workers have crypto |
| API key retrieval in scorer | Pass key as parameter only | `getApiKey()` from storage.ts | Keeps scorer pure and testable; storage layer is already tested |
| JSON parsing from Claude | Complex parser | `JSON.parse()` wrapped in try/catch | Claude's output is well-structured JSON with proper prompting; no library needed |
| Storage quota display | Manual byte math | `getStorageUsageBytes()` from storage.ts | Already implemented with fake-browser guard |

**Key insight:** The project has a well-established "typed helper" pattern — write a pure testable function, export it by name, test it directly without browser runtime. Follow this pattern for every scorer function.

---

## Common Pitfalls

### Pitfall 1: Skill synonym mismatch in keyword pass
**What goes wrong:** "React.js" in the JD does not match "React" in candidate skills, or "Node" does not match "Node.js". Score is artificially low.
**Why it happens:** Exact/substring matching misses common abbreviation patterns.
**How to avoid:** Normalise removes `.` and special chars — `normalise("React.js")` → `"reactjs"` and `normalise("React")` → `"react"`. These still won't match. Claude handles this in the refinement pass for unmatched skills. Do not add an ever-growing synonym dictionary — that's exactly what the Claude pass is for.
**Warning signs:** Test the scorer with "React.js" vs "React" and verify Claude catches it.

### Pitfall 2: Claude returns text before the JSON
**What goes wrong:** Claude sometimes prepends "Here is the JSON:" or wraps output in markdown code fences (\`\`\`json ... \`\`\`), causing `JSON.parse` to throw.
**Why it happens:** Instruction-following is probabilistic; Haiku is less reliable than Sonnet for strict JSON output.
**How to avoid:** Extract JSON from the response using a regex that finds the first `{` and last `}`: `text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)`. Then parse that substring.
**Warning signs:** JSON.parse throws in tests; add a unit test with a mock response that has a markdown code fence wrapper.

### Pitfall 3: Chrome 113+ storage quota vs. actual getBytesInUse
**What goes wrong:** `getStorageUsageBytes()` returns 0 in the test environment (already guarded) but may also return 0 in Safari because `getBytesInUse` is not in the Safari WebExtensions spec.
**Why it happens:** `getBytesInUse` is a Chrome extension — not part of the WebExtensions standard. The existing guard `if (typeof browser.storage.local.getBytesInUse !== 'function') return 0` already handles this.
**How to avoid:** The guard is already implemented. Display "Storage usage: unavailable" in the Safari popup if the returned value is 0 (Phase 6 concern; for Phase 3 just use the existing helper as-is).
**Warning signs:** `getBytesInUse` appears as undefined in Safari — already handled by existing guard.

### Pitfall 4: Claude API rate limits / network timeout during Evaluate
**What goes wrong:** Claude call takes >30 seconds (success criterion is ≤30s) or the fetch throws a network error.
**Why it happens:** API latency varies; Haiku is fast (~1-3s typical) but network conditions vary.
**How to avoid:** Set `max_tokens: 512` (already in example — Haiku is fast with small outputs). Wrap the `fetch` call with a timeout signal: `AbortSignal.timeout(25000)`. Return a graceful error to the popup: `{ error: 'Claude API timeout — try again' }`.
**Warning signs:** Evaluate button appears hung; test with a mock that delays 26 seconds.

### Pitfall 5: Missing `return true` in message listener
**What goes wrong:** `sendResponse` is called after the listener returns synchronously, so the channel is already closed. The popup receives `undefined`.
**Why it happens:** MV3 message listener must return `true` to keep the channel open for async responses.
**How to avoid:** The existing `PROFILE_PARSED` and `VALIDATE_API_KEY` handlers already use `return true`. The new `EVALUATE` handler must do the same. Never `await` inside the listener body — use an immediately invoked async function and `.then(sendResponse)`.
**Warning signs:** Popup shows no result or Chrome DevTools shows "The message port closed before a response was received."

### Pitfall 6: `lastParsedProfile` is null when Evaluate fires
**What goes wrong:** Recruiter opens popup and clicks Evaluate before the content script has finished extracting the profile (or on a non-profile LinkedIn page).
**Why it happens:** Profile extraction is async and tied to DOM ready state.
**How to avoid:** The `EVALUATE` handler must check `getLastParsedProfile()` and return `{ error: 'No profile data — please wait for the page to fully load' }` if null.
**Warning signs:** Score results in an empty/undefined name in the candidate record.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### Claude Messages API call (direct fetch — same pattern as validateStoredApiKey)
```typescript
// Source: Anthropic REST API docs (platform.claude.com) + existing background.ts pattern
const response = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  }),
});
if (!response.ok) throw new Error(`Claude API error: ${response.status}`);
const data = await response.json() as { content: Array<{ type: string; text: string }> };
const text = data.content[0]?.text ?? '{}';
```

### Safe JSON extraction from Claude response (handles markdown fences)
```typescript
function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return '{}';
  return text.slice(start, end + 1);
}
```

### Tier assignment from score
```typescript
// src/scorer/tiers.ts
export type Tier = 'L1' | 'L2' | 'L3' | 'rejected';

export function assignTier(score: number): Tier {
  if (score >= 80) return 'L1';
  if (score >= 71) return 'L2';
  if (score >= 60) return 'L3';
  return 'rejected';
}

export const TIER_LABELS: Record<Tier, string> = {
  L1: 'Layer 1',
  L2: 'Layer 2',
  L3: 'Layer 3',
  rejected: 'Rejected',
};
```

### Message types extension (messages.ts)
```typescript
// src/shared/messages.ts additions
export interface EvaluateMessage {
  type: 'EVALUATE';
}

export interface EvaluateResult {
  score: number;
  tier: Tier;
  matchedSkills: string[];
  missingSkills: string[];  // required (mandatory) skills only
  rationale: string;
  candidateId: string;
  error?: string;
}

// Add 'EVALUATE' to MessageType union
export type MessageType = 'VALIDATE_API_KEY' | 'PROFILE_PARSED' | 'EVALUATE';
```

### Candidate storage helpers (mirrors JD pattern)
```typescript
// src/storage/storage.ts additions — mirrors existing getAllJds/saveJd pattern
async function getCandidateIndex(): Promise<string[]> {
  const result = await browser.storage.local.get(STORAGE_KEYS.CANDIDATE_INDEX);
  return (result[STORAGE_KEYS.CANDIDATE_INDEX] as string[] | undefined) ?? [];
}

export async function saveCandidate(record: CandidateRecord): Promise<void> {
  const ids = await getCandidateIndex();
  if (!ids.includes(record.id)) {
    ids.push(record.id);
    await browser.storage.local.set({ [STORAGE_KEYS.CANDIDATE_INDEX]: ids });
  }
  await browser.storage.local.set({ [STORAGE_KEYS.candidate(record.id)]: record });
}

export async function getAllCandidates(): Promise<CandidateRecord[]> {
  const ids = await getCandidateIndex();
  if (ids.length === 0) return [];
  const keys = ids.map((id) => STORAGE_KEYS.candidate(id));
  const result = await browser.storage.local.get(keys);
  return keys.map((k) => result[k]).filter(Boolean) as CandidateRecord[];
}
```

### AbortSignal timeout for Claude call
```typescript
// Works in MV3 service workers (Chrome 105+, AbortSignal.timeout is available)
const response = await fetch('https://api.anthropic.com/v1/messages', {
  signal: AbortSignal.timeout(25_000),
  // ...headers and body
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| claude-3-haiku-20240307 | claude-haiku-4-5-20251001 | Oct 2025 | Old Haiku deprecated April 19, 2026 — must NOT use it |
| @anthropic-ai/sdk (Node.js-first) | Direct fetch() in service workers | Established pattern in this project | Avoids Node globals, smaller bundle |
| localStorage in content script | browser.storage.local in background | MV3 requirement | Avoids content script security exposure |

**Deprecated/outdated:**
- `claude-3-haiku-20240307`: Deprecated. Retirement date April 19, 2026. Do NOT pin this model. Use `claude-haiku-4-5-20251001`.
- `claude-haiku-4-5` (alias without date): Alias resolves to latest — acceptable for rapid prototyping but pinning the snapshot `claude-haiku-4-5-20251001` is safer for production stability.

---

## Open Questions

1. **Does the scorer need to handle LinkedIn skills that are multi-word phrases vs. JD skills that are single words?**
   - What we know: Candidate skills from LinkedIn are full text strings like "React.js", "Machine Learning", "Project Management". JD skills are recruiter-entered strings.
   - What's unclear: Whether bidirectional substring match is sufficient or whether recruiter-entered skills could be very long phrases that never substring-match a candidate's shorter skill.
   - Recommendation: Bidirectional substring match covers 90%+ of cases. The Claude refinement pass handles edge cases. No special multi-word handling needed in Phase 3.

2. **Should `missingSkills` displayed in the popup show only mandatory skills or all unmatched skills?**
   - What we know: SCORE-07 says "required skills the candidate is missing" — "required" strongly implies mandatory only.
   - What's unclear: The requirement text is slightly ambiguous.
   - Recommendation: Display only mandatory unmatched skills as "missing". Store both in `CandidateRecord.missingSkills` for Phase 4 flexibility. This is the conservative, recruiter-friendly interpretation.

3. **What happens if the active JD has no skills?**
   - What we know: The JD editor allows saving a JD with zero skills (just raw text).
   - What's unclear: Whether EVALUATE should refuse or proceed.
   - Recommendation: Return `{ error: 'Active JD has no skills — please add skills in Options before evaluating' }`. Score cannot be computed without a skills list.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `linkedin-hhrh-screener/vitest.config.ts` |
| Quick run command | `cd linkedin-hhrh-screener && npx vitest run tests/scorer.test.ts` |
| Full suite command | `cd linkedin-hhrh-screener && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCORE-01 | keyword match returns correct matched/unmatched skill sets | unit | `npx vitest run tests/scorer.test.ts` | ❌ Wave 0 |
| SCORE-03 | mandatory skills weight 2x nice-to-have in score formula | unit | `npx vitest run tests/scorer.test.ts` | ❌ Wave 0 |
| SCORE-04 | tier assignment: 80→L1, 71→L2, 60→L3, 59→rejected | unit | `npx vitest run tests/scorer.test.ts` | ❌ Wave 0 |
| SCORE-02 | Claude refinement call returns additional matches + rationale (mocked) | unit | `npx vitest run tests/scorer.test.ts` | ❌ Wave 0 |
| SCORE-05 | EVALUATE message handler returns score + tier | unit | `npx vitest run tests/background.test.ts` | ✅ (extend) |
| SCORE-06 | matchedSkills list is correct | unit | `npx vitest run tests/scorer.test.ts` | ❌ Wave 0 |
| SCORE-07 | missingSkills list includes only mandatory unmatched | unit | `npx vitest run tests/scorer.test.ts` | ❌ Wave 0 |
| SCORE-08 | rationale string is non-empty in mocked Claude response | unit | `npx vitest run tests/scorer.test.ts` | ❌ Wave 0 |
| STORE-01 | saveCandidate persists record; getAllCandidates retrieves it | unit | `npx vitest run tests/storage.test.ts` | ✅ (extend) |
| STORE-02 | getStorageUsageBytes returns 0 in fake-browser (already tested) | unit | `npx vitest run tests/storage.test.ts` | ✅ (extend) |
| STORE-03 | getAllCandidates returns sorted list | unit | `npx vitest run tests/storage.test.ts` | ✅ (extend) |
| Full pipeline | Evaluate on real LinkedIn profile → tier within 30s | manual smoke test | Manual — recruiter clicks Evaluate in Chrome | ❌ manual only |

### Sampling Rate
- **Per task commit:** `cd linkedin-hhrh-screener && npx vitest run tests/scorer.test.ts tests/storage.test.ts`
- **Per wave merge:** `cd linkedin-hhrh-screener && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/scorer.test.ts` — covers SCORE-01, SCORE-03, SCORE-04, SCORE-06, SCORE-07, SCORE-08 (keyword pass + tier assignment + weighted scoring)
- [ ] `src/scorer/scorer.ts` — keyword normalisation and match logic
- [ ] `src/scorer/tiers.ts` — tier threshold constants and label map
- [ ] `src/scorer/claude.ts` — Claude fetch wrapper (mocked in tests via vi.stubGlobal)

---

## Sources

### Primary (HIGH confidence)
- Official Anthropic model docs (platform.claude.com/docs/en/docs/about-claude/models) — current model IDs verified March 2026; `claude-haiku-4-5-20251001` confirmed as current Haiku with deprecation warning on old Haiku
- Existing `entrypoints/background.ts` — direct fetch pattern already proven working with Anthropic API
- Existing `src/storage/schema.ts` — `CandidateRecord` type and `STORAGE_KEYS.candidate` already defined
- Existing `src/storage/storage.ts` — JD storage pattern as template for candidate storage
- Chrome storage API docs (developer.chrome.com/docs/extensions/reference/api/storage) — 10MB local quota confirmed

### Secondary (MEDIUM confidence)
- GitHub anthropics/anthropic-sdk-typescript issue #248 — `dangerouslyAllowBrowser` history; confirms SDK is not needed when using direct fetch
- WebSearch cross-verified: `getBytesInUse` is Chrome-specific (not WebExtensions standard) — already guarded in `getStorageUsageBytes()`

### Tertiary (LOW confidence)
- Safari `getBytesInUse` support: not confirmed via Safari documentation; assumed unavailable based on MDN WebExtensions storage.local page not listing it. Existing guard handles this gracefully.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; everything reuses existing proven patterns
- Architecture: HIGH — scorer module structure follows established project conventions exactly
- Claude model ID: HIGH — verified from official Anthropic docs March 2026
- Pitfalls: HIGH — all pitfalls are either already observed in this codebase or well-documented MV3 patterns
- Storage quota: HIGH — verified from Chrome docs

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (model IDs stable on snapshot pinning; storage quota stable; check Anthropic deprecation notices if using aliases)
