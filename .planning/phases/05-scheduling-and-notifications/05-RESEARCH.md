# Phase 5: Scheduling and Notifications - Research

**Researched:** 2026-03-10
**Domain:** Chrome MV3 alarms, browser notifications, extension badge, WXT background service worker
**Confidence:** HIGH

---

## Summary

Phase 5 adds the final recruiter-facing intelligence loop: Layer 3 candidates evaluated today automatically surface as action items 7 days later. The implementation uses three browser APIs that are already permitted in `wxt.config.ts` — `chrome.alarms`, `chrome.notifications`, and `chrome.action` — all wired inside the existing `background.ts` service worker using the established `defineBackground` + message-listener pattern from Phases 1–4.

The existing code provides everything needed to implement this phase without schema changes. `CandidateRecord` already stores `contactAfter` (ISO 8601, set to `evaluatedAt + 7 days` for L3 candidates) and `handleEvaluate()` already sets it. Phase 5 adds: alarm creation at evaluation time (triggered in `handleEvaluate`), alarm fire handler in background, notification display, badge refresh, and a popup section showing overdue L3 candidates. The popup already calls `getAllCandidates()` on load — the overdue section is additive DOM work, not a new data pipeline.

The `@webext-core/fake-browser` v1.3.4 already implements `alarms.create()`, `alarms.get()`, `alarms.getAll()`, `alarms.clear()`, and `onAlarm.trigger()` — the test surface for all four SCHED requirements is fully covered without mocking. `notifications.create()` and `notifications.getAll()` are similarly implemented. `browser.action.setBadgeText()` is NOT in fake-browser but can be mocked with `vi.spyOn`.

**Primary recommendation:** Add alarm creation to `handleEvaluate` when tier is L3; add `browser.alarms.onAlarm` and `browser.runtime.onInstalled`/`onStartup` listeners inside `defineBackground`; refresh the badge from a shared `refreshBadge()` helper called at all state-change points; add a `#overdue-section` to the popup HTML/JS that calls `getAllCandidates()` filtered on `contactAfter <= now && !messageSentAt`.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCHED-01 | When a Layer 3 candidate is evaluated, a `chrome.alarms` entry is created to fire 7 days later | `handleEvaluate()` already sets `contactAfter`; add `browser.alarms.create(candidateId, { when: Date.parse(record.contactAfter) })` immediately after `saveCandidate()` |
| SCHED-02 | When the alarm fires, a browser system notification is shown to remind the recruiter to contact the Layer 3 candidate | Add `browser.alarms.onAlarm.addListener` inside `defineBackground`; call `browser.notifications.create()` with type `basic`, `title`, `message`, `iconUrl` |
| SCHED-03 | The extension icon badge count reflects the number of L3 candidates whose 7-day window has passed and have not yet been contacted | `refreshBadge()` helper: `getAllCandidates()` → filter `tier === 'L3' && contactAfter <= now && !messageSentAt` → `browser.action.setBadgeText({ text: count > 0 ? String(count) : '' })` |
| SCHED-04 | The extension popup shows a list of Layer 3 candidates whose contact window has opened (7+ days since evaluation) | New `#overdue-section` in popup HTML; `renderOverdueL3()` function in `index.ts` using the same `getAllCandidates()` call already present |
</phase_requirements>

---

## Standard Stack

### Core (all already installed and permitted)

| Library / API | Version / Status | Purpose | Why Standard |
|---------------|-----------------|---------|--------------|
| `chrome.alarms` (via `browser.alarms`) | MV3 built-in, Chrome 120+ min 30s | Schedule the 7-day follow-up | Native browser API; persists across service worker restarts; no external dependency |
| `chrome.notifications` (via `browser.notifications`) | MV3 built-in | Show system notification when alarm fires | Native; already in manifest permissions |
| `chrome.action` (via `browser.action`) | MV3 built-in | Set icon badge text and background color | Native; MV3 renamed from `chrome.browserAction` |
| `@webext-core/fake-browser` | v1.3.4 (installed) | Unit-test all alarm and notification logic | Implements `alarms.*`, `notifications.*`, `onAlarm.trigger()` — no additional installs |
| WXT `defineBackground` | WXT 0.20.18 (installed) | Register alarm listener alongside existing message listener | Established pattern; same `main()` function scope |

### No New Dependencies Required

All required APIs are already declared in `wxt.config.ts` permissions:

```
'alarms'        ← SCHED-01, SCHED-02
'notifications' ← SCHED-02
```

`chrome.action` requires no manifest permission — it is automatically available to MV3 extensions.

**Installation:** None. Zero new packages needed for this phase.

---

## Architecture Patterns

### Recommended File Changes

```
entrypoints/
└── background.ts          ← Add: alarm creation in handleEvaluate,
                              alarms.onAlarm listener, runtime.onInstalled/onStartup
                              for badge refresh, refreshBadge() helper

entrypoints/popup/
├── index.html             ← Add: #overdue-section with list container
└── index.ts               ← Add: renderOverdueL3() called on popup load

src/shared/
└── messages.ts            ← Add: GET_OVERDUE_L3 message type (optional —
                              popup can call getAllCandidates() directly
                              since it already imports from storage.ts)

tests/
└── background.test.ts     ← Add: SCHED-01 through SCHED-03 tests
                              using fakeBrowser.alarms.trigger() and
                              vi.spyOn(browser.action, 'setBadgeText')
```

### Pattern 1: Alarm Creation at Evaluation Time (SCHED-01)

**What:** Immediately after `saveCandidate(record)` in `handleEvaluate`, create a named alarm keyed by the candidate UUID. The `when` property is set to the already-computed `record.contactAfter` timestamp (evaluatedAt + 7 days).

**When to use:** Only when `tier === 'L3'` — the `contactAfter` field already guards this.

```typescript
// In handleEvaluate(), after saveCandidate(record):
if (record.contactAfter) {
  await browser.alarms.create(`l3-followup-${record.id}`, {
    when: new Date(record.contactAfter).getTime(),
  });
}
```

**Key facts:**
- `alarms.create()` with the same name replaces any existing alarm — idempotent if candidate is re-evaluated
- `when` accepts milliseconds since epoch — `Date.parse(record.contactAfter)` or `new Date(record.contactAfter).getTime()`
- The alarm persists across service worker restarts; Chrome relaunches the worker when the alarm fires
- Alarm names must be strings; using `candidate.id` as the suffix enables lookup on firing

### Pattern 2: Alarm Fire Handler (SCHED-02)

**What:** Inside `defineBackground`'s `main()` function, register `browser.alarms.onAlarm.addListener` alongside the existing `runtime.onMessage.addListener`. Parse the candidate ID from the alarm name, look up the candidate, and call `browser.notifications.create()`.

```typescript
// Inside defineBackground(() => { ... }):
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith('l3-followup-')) return;
  const candidateId = alarm.name.replace('l3-followup-', '');
  const candidate = await getCandidate(candidateId);
  if (!candidate || candidate.messageSentAt) return; // already contacted

  await browser.notifications.create(`notif-${candidateId}`, {
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon/128.png'),  // or nearest available icon
    title: 'L3 Follow-up Ready',
    message: `Time to contact ${candidate.name} — their 7-day window has opened.`,
  });

  await refreshBadge();
});
```

**iconUrl requirement:** `notifications.create()` requires a non-empty `iconUrl`. Use `browser.runtime.getURL()` pointing to an existing extension icon. Check `public/icon/` directory for available icon sizes. The icon path must be a real asset reachable at the URL — verify the actual path after build.

### Pattern 3: Badge Refresh (SCHED-03)

**What:** A shared async helper `refreshBadge()` that queries all candidates, counts overdue uncontacted L3s, and sets the badge. Call it from: alarm fire handler, `runtime.onInstalled`, `runtime.onStartup`, and the `EVALUATE` message handler (after saving the candidate).

```typescript
export async function refreshBadge(): Promise<void> {
  const candidates = await getAllCandidates();
  const now = Date.now();
  const overdueCount = candidates.filter(
    (c) =>
      c.tier === 'L3' &&
      c.contactAfter !== undefined &&
      new Date(c.contactAfter).getTime() <= now &&
      !c.messageSentAt,
  ).length;

  const text = overdueCount > 0 ? String(overdueCount) : '';
  await browser.action.setBadgeText({ text });
  if (overdueCount > 0) {
    await browser.action.setBadgeBackgroundColor({ color: '#E53935' });
  }
}
```

**Badge clear:** Pass `{ text: '' }` to clear — empty string, not `null`. Passing nothing or undefined throws in MV3.

**When to call refreshBadge:**
1. `browser.runtime.onInstalled.addListener` — extension installed/updated
2. `browser.runtime.onStartup.addListener` — browser started
3. After `alarms.onAlarm` fires and notification is shown
4. After `handleSaveMessage` marks a candidate as contacted (badge should decrement)

### Pattern 4: Popup Overdue L3 Section (SCHED-04)

**What:** Add a new `<section id="overdue-section">` to the popup HTML. In `index.ts`, add a `renderOverdueL3()` function that calls the already-imported `getAllCandidates()`, filters for overdue L3s, and renders the list. Call it alongside `renderCandidateList()` at popup load.

```typescript
async function renderOverdueL3(): Promise<void> {
  const el = document.getElementById('overdue-list');
  if (!el) return;

  const candidates = await getAllCandidates();
  const now = Date.now();
  const overdue = candidates.filter(
    (c) =>
      c.tier === 'L3' &&
      c.contactAfter !== undefined &&
      new Date(c.contactAfter).getTime() <= now &&
      !c.messageSentAt,
  );

  if (overdue.length === 0) {
    el.textContent = 'No L3 candidates awaiting contact';
    return;
  }

  const ul = document.createElement('ul');
  for (const c of overdue) {
    const li = document.createElement('li');
    const contactAfterDate = c.contactAfter!.substring(0, 10);
    li.textContent = `${c.name} — contact window open since ${contactAfterDate}`;
    ul.appendChild(li);
  }
  el.innerHTML = '';
  el.appendChild(ul);
}
```

**Popup HTML addition** (after `#history-section`):
```html
<section id="overdue-section">
  <h2>L3 Follow-ups Due</h2>
  <div id="overdue-list">Loading...</div>
</section>
```

The popup already imports `getAllCandidates` — no new imports required.

### Pattern 5: WXT defineBackground Registration Order

**What:** All event listeners must be registered synchronously inside the `defineBackground` callback `main()` body, before any `await`. Chrome MV3 requires listeners to be registered in the same microtask as the service worker startup.

```typescript
export default defineBackground(() => {
  // 1. Register ALL listeners synchronously first
  browser.alarms.onAlarm.addListener(async (alarm) => { /* ... */ });
  browser.runtime.onInstalled.addListener(() => { refreshBadge(); });
  browser.runtime.onStartup.addListener(() => { refreshBadge(); });
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // ... existing handlers ...
  });
});
```

This is the established pattern from Phase 1 onward. The alarm listener is purely additive.

### Anti-Patterns to Avoid

- **Registering alarm listeners outside `defineBackground` main():** Listeners registered in module scope (outside `defineBackground`) may not be called when the service worker restarts to handle an alarm — Chrome requires synchronous registration inside the activation event.
- **Using `delayInMinutes: 7 * 24 * 60` instead of `when`:** Both work, but `when` maps directly to `record.contactAfter` which is already computed and stored — no duplication of the 7-day math.
- **Not guarding against already-contacted candidates in alarm handler:** Alarm fires even if the recruiter already sent the message. Always check `!candidate.messageSentAt` before showing a notification.
- **Calling `refreshBadge` from popup directly instead of background:** Badge operations work from any context, but centralizing in background ensures badge is refreshed even when popup is closed (e.g., after alarm fires).
- **Missing iconUrl in notifications.create():** Chrome throws if `iconUrl` is omitted or empty. Use `browser.runtime.getURL()` with a real asset path.
- **Not clearing alarm when candidate is deleted:** If `deleteCandidate()` is ever called (currently no UI for this), `browser.alarms.clear('l3-followup-' + id)` must also run.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scheduled callbacks | `setTimeout` loop or `setInterval` | `browser.alarms` | `setTimeout` is cleared when service worker sleeps; `alarms` persist and wake the worker |
| Persistence across browser restarts | Any custom timer state in memory | `chrome.alarms` | Platform-persisted; survive browser quit/reopen |
| System tray notifications | DOM-based overlay in popup | `browser.notifications` | Native OS notification; shows even with popup closed |
| Badge state on startup | Recomputing from a separate flag key | `getAllCandidates()` filtered in `refreshBadge()` | `contactAfter` and `messageSentAt` are already the source of truth |

**Key insight:** `chrome.alarms` is the only correct solution for sub-hour scheduled events in MV3 extensions. Every alternative (setTimeout, IndexedDB polling, keepalive pings) fails when the service worker terminates between events.

---

## Common Pitfalls

### Pitfall 1: Service Worker Termination Before Listener Registration
**What goes wrong:** If any async operation runs before `browser.alarms.onAlarm.addListener(...)` is called, Chrome may not associate the listener with alarm events — the alarm fires but nothing happens.
**Why it happens:** MV3 service workers must register event listeners synchronously during the activation microtask.
**How to avoid:** Register all `addListener` calls at the top of the `defineBackground` callback, before any `await`. The existing `onMessage.addListener` already does this correctly.
**Warning signs:** Alarms fire (confirmed via Chrome extensions page) but notification never appears.

### Pitfall 2: iconUrl Not Pointing to a Real Extension Asset
**What goes wrong:** `browser.notifications.create()` silently fails or throws if `iconUrl` points to a path that does not exist in the built extension.
**Why it happens:** Chrome validates the URL at notification creation time. Data URLs work; relative paths must resolve against the extension origin.
**How to avoid:** Use `browser.runtime.getURL('/icon/128.png')` and verify that path exists in the WXT `public/` directory. Check the `.output/` folder after `wxt build` to confirm.
**Warning signs:** Notification never appears in Chrome; no console error visible from background (check via `chrome://extensions` → service worker devtools).

### Pitfall 3: Badge Text Not Clearing After Contact Marked
**What goes wrong:** Badge count shows stale overdue count after recruiter marks a message as sent.
**Why it happens:** `handleSaveMessage` sets `messageSentAt` but nothing calls `refreshBadge()` after.
**How to avoid:** Call `await refreshBadge()` at the end of `handleSaveMessage` (or add a `REFRESH_BADGE` message that popup sends after mark-sent).
**Warning signs:** Badge count stays at 1 even after clicking "Mark as Sent" for the only overdue L3.

### Pitfall 4: Alarm Created Multiple Times for Same Candidate
**What goes wrong:** Re-evaluating the same L3 candidate creates a duplicate alarm or a shifted alarm.
**Why it happens:** `alarms.create()` with a name that already exists replaces the existing alarm. This is actually correct behavior — the 7-day clock resets on re-evaluation.
**How to avoid:** The replacement behavior is correct for this use case. Document this decision explicitly in code comments.
**Warning signs:** None from browser; this is safe by API contract.

### Pitfall 5: browser.action Not Available in Fake-Browser Test Context
**What goes wrong:** `browser.action.setBadgeText()` throws `TypeError: browser.action.setBadgeText is not a function` in Vitest tests.
**Why it happens:** `@webext-core/fake-browser` v1.3.4 does not implement the `action` API (confirmed by inspecting `index.d.ts`).
**How to avoid:** Use `vi.spyOn(browser.action, 'setBadgeText').mockResolvedValue(undefined)` in tests that exercise `refreshBadge()`. Assert the spy was called with expected arguments.
**Warning signs:** Test throws on the first `refreshBadge()` call.

### Pitfall 6: Safari alarms Persistence Uncertainty (Flagged in STATE.md)
**What goes wrong:** Safari may not persist `browser.alarms` entries across browser sessions in the same way Chrome does.
**Why it happens:** Safari Web Extensions implement a subset of the WebExtensions API; alarm persistence behavior may differ.
**How to avoid:** Phase 5 targets Chrome (XBROW-01). Safari verification is Phase 6. Use `browser.runtime.onStartup` + `refreshBadge()` as a fallback to recompute badge on browser launch regardless of alarm state. Document as known gap for Phase 6.
**Warning signs:** Badge does not show correct count after Safari is restarted.

---

## Code Examples

Verified patterns from API documentation and fake-browser source:

### Creating an Alarm with an Absolute Timestamp
```typescript
// Source: https://developer.chrome.com/docs/extensions/reference/api/alarms
await browser.alarms.create(`l3-followup-${candidateId}`, {
  when: new Date(contactAfterIso).getTime(), // milliseconds since epoch
});
```

### Triggering Alarm in Tests (fake-browser)
```typescript
// Source: @webext-core/fake-browser lib/index.js onAlarm.trigger()
// fakeBrowser.alarms.onAlarm is an EventForTesting — call .trigger() to simulate alarm fire
await fakeBrowser.alarms.onAlarm.trigger({
  name: `l3-followup-${candidateId}`,
  scheduledTime: Date.now(),
});
```

### Verifying Alarm Was Created in Tests
```typescript
// Source: @webext-core/fake-browser lib/index.js alarms.getAll()
const allAlarms = await browser.alarms.getAll();
const alarm = allAlarms.find((a) => a.name === `l3-followup-${candidateId}`);
expect(alarm).toBeDefined();
expect(alarm!.scheduledTime).toBeCloseTo(expectedTimestamp, -3);
```

### Creating a Notification (MV3)
```typescript
// Source: https://developer.chrome.com/docs/extensions/reference/api/notifications
await browser.notifications.create(`notif-${candidateId}`, {
  type: 'basic',
  iconUrl: browser.runtime.getURL('/icon/128.png'),
  title: 'Layer 3 Follow-up Ready',
  message: `Contact ${candidateName} — their 7-day window is now open.`,
});
```

### Verifying Notification Was Created in Tests
```typescript
// Source: @webext-core/fake-browser lib/index.js notifications.getAll()
const notifs = await browser.notifications.getAll();
expect(notifs[`notif-${candidateId}`]).toBeDefined();
expect(notifs[`notif-${candidateId}`].message).toContain(candidateName);
```

### Mocking browser.action in Vitest
```typescript
// browser.action not in fake-browser — use vi.spyOn
const setBadgeTextSpy = vi.spyOn(browser.action, 'setBadgeText').mockResolvedValue(undefined);
const setBadgeColorSpy = vi.spyOn(browser.action, 'setBadgeBackgroundColor').mockResolvedValue(undefined);

await refreshBadge();

expect(setBadgeTextSpy).toHaveBeenCalledWith({ text: '1' });
```

### Setting Badge Text (MV3)
```typescript
// Source: https://developer.chrome.com/docs/extensions/reference/api/action
await browser.action.setBadgeText({ text: '3' });           // show count
await browser.action.setBadgeText({ text: '' });            // clear badge
await browser.action.setBadgeBackgroundColor({ color: '#E53935' }); // red
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `chrome.browserAction.setBadgeText()` | `chrome.action.setBadgeText()` | MV3 (Chrome 88+) | `browserAction` is MV2; use `action` namespace |
| Minimum alarm interval: 1 minute | Minimum alarm interval: 30 seconds | Chrome 120 (late 2023) | 7-day delay is unaffected; minimum only matters for very short intervals |
| Alarm callbacks (MV2) | Alarm promises (MV3) | MV3 | `browser.alarms.create()` returns `Promise<void>` in MV3 |
| `chrome.notifications` callback-based | Promise-based in MV3 | MV3 | `await browser.notifications.create()` works |

**Deprecated/outdated:**
- `chrome.browserAction`: Replaced by `chrome.action` in MV3. Already NOT used in this project.
- `chrome.notifications` `requireInteraction` option: Works but rarely needed for reminder notifications.

---

## Open Questions

1. **Icon path for notifications.create() iconUrl**
   - What we know: `iconUrl` must be a non-empty URL pointing to a real extension asset
   - What's unclear: The exact path of the icon file in the WXT `public/` directory (e.g., `public/icon/128.png` vs `public/icons/128.png`) has not been verified
   - Recommendation: Before writing the alarm handler, run `wxt build` and inspect `.output/chrome-mv3/` to find the canonical icon path, then use `browser.runtime.getURL('/icon/128.png')` (or correct path)

2. **Badge refresh after popup "Mark as Sent" (SCHED-03 edge case)**
   - What we know: `handleSaveMessage` sets `messageSentAt` but does not call `refreshBadge()`
   - What's unclear: Should the popup send a message to background to refresh badge, or should `handleSaveMessage` in background call `refreshBadge()` itself?
   - Recommendation: Have `handleSaveMessage` in background call `refreshBadge()` directly — it already runs in the background context and has access to the helper. Simpler than a popup-initiated round-trip.

3. **Safari alarm persistence (Phase 6 concern, not Phase 5)**
   - What we know: STATE.md flags this as a Phase 6 blocker
   - What's unclear: Whether `browser.runtime.onStartup` + `refreshBadge()` is sufficient fallback for Safari
   - Recommendation: Implement Phase 5 for Chrome only; leave Safari alarm verification to Phase 6 per existing plan

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `linkedin-hhrh-screener/vitest.config.ts` |
| Quick run command | `cd linkedin-hhrh-screener && npx vitest run tests/background.test.ts` |
| Full suite command | `cd linkedin-hhrh-screener && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCHED-01 | `handleEvaluate()` on L3 candidate creates alarm via `browser.alarms.create` | unit | `npx vitest run tests/background.test.ts` | ✅ (extend existing file) |
| SCHED-01 | Alarm name is `l3-followup-{candidateId}`, `when` equals `contactAfter` timestamp | unit | `npx vitest run tests/background.test.ts` | ✅ |
| SCHED-01 | Non-L3 candidates do NOT create an alarm | unit | `npx vitest run tests/background.test.ts` | ✅ |
| SCHED-02 | When `alarms.onAlarm` fires with matching name, `notifications.create()` is called | unit | `npx vitest run tests/background.test.ts` | ✅ (extend) |
| SCHED-02 | Notification includes candidate name in message | unit | `npx vitest run tests/background.test.ts` | ✅ |
| SCHED-02 | Already-contacted candidates (messageSentAt set) do NOT trigger notification | unit | `npx vitest run tests/background.test.ts` | ✅ |
| SCHED-03 | `refreshBadge()` sets badge text to overdue L3 count (spy on `browser.action.setBadgeText`) | unit | `npx vitest run tests/background.test.ts` | ✅ |
| SCHED-03 | Badge clears to empty string when no overdue L3s exist | unit | `npx vitest run tests/background.test.ts` | ✅ |
| SCHED-04 | `renderOverdueL3()` renders overdue L3 names in popup DOM | unit | `npx vitest run tests/background.test.ts` | ❌ Wave 0 — needs popup unit test or manual verification |
| SCHED-04 | Popup section shows "No L3 candidates" when list is empty | unit | manual or popup test | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd linkedin-hhrh-screener && npx vitest run tests/background.test.ts`
- **Per wave merge:** `cd linkedin-hhrh-screener && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/background.test.ts` — extend with SCHED-01 through SCHED-03 describe blocks (file exists, add new `describe` blocks)
- [ ] SCHED-04 popup rendering is not unit-tested (existing popup has no test file); recommend human verification checkpoint covers it (same pattern used for popup in Phase 3 and Phase 4)
- [ ] `vi.spyOn(browser.action, 'setBadgeText')` boilerplate — add to `beforeEach` in new SCHED describe blocks

---

## Sources

### Primary (HIGH confidence)
- `@webext-core/fake-browser` v1.3.4 lib/index.js — alarms full implementation (create, get, getAll, clear, clearAll, onAlarm.trigger), notifications full implementation (create, clear, getAll)
- `@webext-core/fake-browser` v1.3.4 lib/index.d.ts — confirms `action` is NOT in fake-browser type exports (vi.spyOn required)
- `@wxt-dev/browser` v0.1.37 src/gen/index.d.ts — `browser.action.setBadgeText`, `browser.action.setBadgeBackgroundColor` type signatures confirmed
- `wxt.config.ts` — `alarms` and `notifications` permissions already declared
- `entrypoints/background.ts` — existing `defineBackground` + `onMessage.addListener` pattern; `handleEvaluate()` already sets `contactAfter`
- `src/storage/schema.ts` — `CandidateRecord.contactAfter` (ISO 8601, optional, L3 only); `messageSentAt` (ISO 8601, optional)
- `entrypoints/popup/index.ts` — already imports `getAllCandidates`; `renderCandidateList()` pattern to follow for `renderOverdueL3()`
- [chrome.alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms) — `create()` params, `when` vs `delayInMinutes`, Chrome 120 minimum 30s
- [chrome.notifications API](https://developer.chrome.com/docs/extensions/reference/api/notifications) — required fields: `type`, `iconUrl`, `title`, `message`
- [chrome.action API](https://developer.chrome.com/docs/extensions/reference/api/action) — `setBadgeText({ text: '' })` clears badge; empty string required

### Secondary (MEDIUM confidence)
- WebSearch: Chrome 120 reduced minimum alarm interval from 1 minute to 30 seconds — cross-verified with official docs
- WebSearch: `chrome.action` replaces `chrome.browserAction` in MV3 — cross-verified with official docs

### Tertiary (LOW confidence)
- WebSearch: WXT `@wxt-dev/alarms` proposal (GitHub issue #1539) — a proposed WXT wrapper for alarms API; NOT released; use native `browser.alarms` directly

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all APIs verified in installed node_modules types and official Chrome docs
- Architecture: HIGH — patterns derived directly from existing background.ts and fake-browser source code
- Pitfalls: HIGH — fake-browser inspection confirmed `action` API gap; alarm listener ordering is documented Chrome behavior; iconUrl requirement from official docs
- Test infrastructure: HIGH — fake-browser alarms/notifications implementation confirmed in source; only `browser.action` needs spying

**Research date:** 2026-03-10
**Valid until:** 2026-09-10 (Chrome MV3 APIs are stable; re-verify if Chrome 130+ changes alarm behavior)
