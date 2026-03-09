# Roadmap: LinkedIn HHRR Candidate Screener

## Overview

Six phases build on each other in strict dependency order: the security architecture and storage schema must exist before profile extraction can be built, profile extraction must be validated before the AI scoring pipeline can be tested end-to-end, and the full Chrome feature set must be stable before the Safari packaging is finalized. The result is a browser extension that lets a recruiter open any LinkedIn profile and receive a tier classification, match explanation, and tailored outreach message in one click — stored locally with no backend required.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Extension scaffold, storage schema, API key settings, JD management, and Safari Xcode setup
- [ ] **Phase 2: Profile Parsing** - LinkedIn DOM extraction, SPA navigation detection, and selector abstraction layer
- [ ] **Phase 3: Scoring Pipeline** - Hybrid keyword + Claude scoring, tier assignment, candidate storage, and score display
- [ ] **Phase 4: Output Layer** - Popup UI, message generation and review, candidate history view, and CSV export
- [ ] **Phase 5: Scheduling and Notifications** - Layer 3 alarms, browser notifications, badge counter, and overdue contact list
- [ ] **Phase 6: Safari Packaging and Cross-Browser Verification** - Signed Safari build, feature parity verification, and submission prep

## Phase Details

### Phase 1: Foundation
**Goal**: A working extension shell is loadable in both Chrome and Safari developer mode with the storage schema, API key management, and JD management in place — every subsequent phase builds on this without rework
**Depends on**: Nothing (first phase)
**Requirements**: SET-01, SET-02, SET-03, SET-04, SET-05, SET-06
**Success Criteria** (what must be TRUE):
  1. Recruiter can load the extension in Chrome developer mode and open the options page without errors
  2. Recruiter can enter, save, and validate their Claude API key in the options page (key never appears in content script context)
  3. Recruiter can create, name, paste text into, and delete multiple job descriptions from the options page
  4. Recruiter can mark individual skills within a JD as mandatory or nice-to-have and save that weighting
  5. Recruiter can select which saved JD is the active one for the current evaluation session
**Plans**: 7 plans

Plans:
- [ ] 01-01-PLAN.md — WXT project scaffold, storage schema types, Vitest test infrastructure
- [ ] 01-02-PLAN.md — Typed storage helpers implementation (TDD: storage.test.ts)
- [ ] 01-03-PLAN.md — Background service worker VALIDATE_API_KEY handler (TDD: background.test.ts)
- [ ] 01-04-PLAN.md — Options page HTML + API key section + JD create/delete
- [ ] 01-05-PLAN.md — Options page skill weighting editor + active JD selector
- [ ] 01-06-PLAN.md — Safari Xcode project scaffold and build pipeline
- [ ] 01-07-PLAN.md — Human verification checkpoint: all SET-01 through SET-06 in Chrome

### Phase 2: Profile Parsing
**Goal**: The extension reliably extracts structured candidate data from the current LinkedIn profile page and relays it to the background service worker, including detection of SPA navigation to a new profile
**Depends on**: Phase 1
**Requirements**: PARSE-01, PARSE-02, PARSE-03, PARSE-04, PARSE-05, PARSE-06
**Success Criteria** (what must be TRUE):
  1. Opening a LinkedIn profile page causes the extension to extract the candidate's name, headline, skills, experience (titles, companies, durations), education (degrees, institutions), and About text
  2. Navigating from one LinkedIn profile to another within the same tab causes the extension to detect the change and re-extract data for the new profile without a page reload
  3. If extraction fails or fields are missing, the extension surfaces a field-level health report to the recruiter rather than silently proceeding with incomplete data
  4. All LinkedIn DOM selectors are defined in a single abstraction file; no selector strings appear in scoring or messaging logic
**Plans**: TBD

### Phase 3: Scoring Pipeline
**Goal**: Parsed profile data flows through the hybrid scoring engine and emerges as a tier classification, match percentage, skill match/gap breakdown, Claude rationale, and a persisted candidate record — the core value loop is complete
**Depends on**: Phase 2
**Requirements**: SCORE-01, SCORE-02, SCORE-03, SCORE-04, SCORE-05, SCORE-06, SCORE-07, SCORE-08, STORE-01, STORE-02, STORE-03
**Success Criteria** (what must be TRUE):
  1. Clicking "Evaluate" on a LinkedIn profile produces a tier label (Layer 1 / Layer 2 / Layer 3 / Rejected) and a match percentage within 30 seconds
  2. The extension displays which JD skills the candidate matches and which required skills are missing
  3. The extension displays Claude's brief rationale explaining why the candidate received that tier
  4. Mandatory skills carry higher weight than nice-to-have skills in the final score
  5. The evaluated candidate record (name, URL, tier, score, matched/missing skills, date) is saved to local storage and visible in the history view; recruiter can see current storage usage
**Plans**: TBD

### Phase 4: Output Layer
**Goal**: The recruiter can review, edit, and act on an AI-generated outreach message from inside the extension panel, and can export all evaluated candidates to CSV — the full recruiter workflow is usable from start to finish
**Depends on**: Phase 3
**Requirements**: MSG-01, MSG-02, MSG-03, MSG-04, MSG-05, MSG-06, CSV-01, CSV-02, CSV-03, CSV-04, CSV-05
**Success Criteria** (what must be TRUE):
  1. After scoring, the extension generates a tier-appropriate outreach message (Layer 1: direct/enthusiastic, Layer 2: exploratory, Layer 3: future-opportunity with delayed-contact framing)
  2. Recruiter can edit the generated message text inside the extension panel before taking any action
  3. Clicking the send action opens LinkedIn's native message compose window with the candidate pre-filled; no message is sent automatically
  4. The sent message text and timestamp are saved to the candidate's local record
  5. Recruiter can export all evaluated candidates to a CSV file containing name, title, URL, tier, score, matched skills, missing skills, evaluation date, contact-after date (Layer 3 only), and sent message text
**Plans**: TBD

### Phase 5: Scheduling and Notifications
**Goal**: Layer 3 candidates are automatically scheduled for a 7-day follow-up reminder via browser alarm; overdue contacts surface in both system notifications and an in-extension list so the recruiter cannot miss them even if notifications are blocked
**Depends on**: Phase 4
**Requirements**: SCHED-01, SCHED-02, SCHED-03, SCHED-04
**Success Criteria** (what must be TRUE):
  1. When a Layer 3 candidate is evaluated, the extension automatically creates a 7-day alarm with no manual action required from the recruiter
  2. When the alarm fires, a system browser notification is shown naming the Layer 3 candidate and prompting the recruiter to make contact
  3. The extension icon badge displays the count of Layer 3 candidates whose 7-day window has passed and who have not yet been contacted
  4. The extension popup shows a list of Layer 3 candidates whose contact window is open, so the recruiter can act even if system notifications were denied
**Plans**: TBD

### Phase 6: Safari Packaging and Cross-Browser Verification
**Goal**: The extension runs identically in Safari with a signed Xcode build, all features verified at parity with Chrome, ready for App Store submission if distribution beyond developer mode is required
**Depends on**: Phase 5
**Requirements**: XBROW-01, XBROW-02, XBROW-03
**Success Criteria** (what must be TRUE):
  1. The Chrome build loads and passes a full end-to-end recruiter workflow without errors (evaluate → tier → message → export)
  2. The Safari build loads in Safari via the Xcode project and passes the same end-to-end workflow as Chrome
  3. Every feature available in Chrome is confirmed working in Safari: settings, JD management, profile parsing, scoring, messaging, CSV export, and Layer 3 scheduling
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/7 | In Progress|  |
| 2. Profile Parsing | 0/TBD | Not started | - |
| 3. Scoring Pipeline | 0/TBD | Not started | - |
| 4. Output Layer | 0/TBD | Not started | - |
| 5. Scheduling and Notifications | 0/TBD | Not started | - |
| 6. Safari Packaging and Cross-Browser Verification | 0/TBD | Not started | - |
