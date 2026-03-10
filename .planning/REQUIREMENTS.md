# Requirements: LinkedIn HHRR Candidate Screener

**Defined:** 2026-03-06
**Core Value:** A recruiter can open any LinkedIn profile and know within seconds whether to pursue the candidate, which tier they fall into, and have a ready-to-send personalized message — all in one click.

## v1 Requirements

### Settings

- [x] **SET-01**: Recruiter can enter and save their Anthropic Claude API key in the extension options page
- [x] **SET-02**: API key is stored exclusively in the background service worker context and never exposed to the content script
- [x] **SET-03**: Recruiter can create, name, and save multiple job descriptions inside the extension
- [x] **SET-04**: Recruiter can paste raw JD text into the extension to import it as a saved JD
- [x] **SET-05**: Recruiter can mark individual skills in a JD as mandatory vs. nice-to-have for weighted scoring
- [x] **SET-06**: Recruiter can select which saved JD to use for the current evaluation session

### Profile Parsing

- [x] **PARSE-01**: Extension extracts the candidate's listed skills from the LinkedIn Skills section when viewing their profile
- [x] **PARSE-02**: Extension extracts job titles, companies, and duration from the candidate's Experience section
- [x] **PARSE-03**: Extension extracts degrees and institutions from the candidate's Education section
- [x] **PARSE-04**: Extension extracts the candidate's About / Summary text
- [x] **PARSE-05**: LinkedIn DOM selectors are abstracted behind a configuration layer so they can be updated without changing scoring logic
- [x] **PARSE-06**: Extension detects LinkedIn SPA navigation and re-triggers parsing when the recruiter moves to a new profile

### Scoring

- [x] **SCORE-01**: Extension scores the parsed profile against the selected JD using keyword matching as a first pass
- [x] **SCORE-02**: Extension calls Claude API (from background service worker) to refine the score for ambiguous or synonym skills
- [x] **SCORE-03**: Mandatory skills have higher weight than nice-to-have skills in the final score
- [x] **SCORE-04**: Extension assigns the candidate a tier based on final match percentage: Layer 1 (80%+), Layer 2 (71–79%), Layer 3 (60–70%), Rejected (<60%)
- [x] **SCORE-05**: Extension displays the overall match percentage and tier label to the recruiter
- [x] **SCORE-06**: Extension displays the list of JD skills the candidate matches
- [x] **SCORE-07**: Extension displays the list of required skills the candidate is missing
- [x] **SCORE-08**: Extension displays Claude's brief rationale explaining the score and tier assignment

### Candidate Storage

- [x] **STORE-01**: Evaluated candidate record (name, title, LinkedIn URL, tier, score, matched skills, missing skills, evaluation date) is saved to browser local storage
- [x] **STORE-02**: Storage usage indicator is visible in the extension so the recruiter knows how much space is being used
- [x] **STORE-03**: Recruiter can view previously evaluated candidates in the extension panel

### Messaging

- [x] **MSG-01**: Extension generates a tailored outreach message for Layer 1 candidates using a tone-appropriate template
- [x] **MSG-02**: Extension generates a tailored outreach message for Layer 2 candidates using an exploratory-tone template
- [x] **MSG-03**: Extension generates a tailored outreach message for Layer 3 candidates using a future-opportunity-tone template, noting the delayed contact intent
- [x] **MSG-04**: Recruiter can edit the generated message in the extension panel before sending
- [x] **MSG-05**: Extension provides a button that opens LinkedIn's native message compose window with the candidate pre-filled
- [x] **MSG-06**: Sent message text and timestamp are saved to the candidate's local record (message history)

### CSV Export

- [x] **CSV-01**: Recruiter can export all evaluated candidates to a CSV file
- [x] **CSV-02**: CSV includes: candidate name, title, LinkedIn URL, tier, match score
- [x] **CSV-03**: CSV includes: matched skills and missing skills (comma-separated) per candidate
- [x] **CSV-04**: CSV includes: evaluation date and "Contact After" date for Layer 3 candidates (evaluation date + 7 days)
- [x] **CSV-05**: CSV includes: outreach message text that was sent

### Layer 3 Scheduling

- [ ] **SCHED-01**: When a Layer 3 candidate is evaluated, a `chrome.alarms` entry is created to fire 7 days later
- [ ] **SCHED-02**: When the alarm fires, a browser system notification is shown to remind the recruiter to contact the Layer 3 candidate
- [ ] **SCHED-03**: The extension icon badge count reflects the number of Layer 3 candidates whose 7-day window has passed and have not yet been contacted
- [ ] **SCHED-04**: The extension popup shows a list of Layer 3 candidates whose contact window has opened (7+ days since evaluation)

### Cross-Browser

- [ ] **XBROW-01**: Extension runs on Chrome (Manifest V3)
- [ ] **XBROW-02**: Extension runs on Safari via Safari Web Extension wrapper (Xcode)
- [ ] **XBROW-03**: All features have functional parity between Chrome and Safari

## v2 Requirements

### Enhanced Matching

- **V2-MATCH-01**: Configurable scoring thresholds (recruiter adjusts tier cutoffs)
- **V2-MATCH-02**: Multi-JD comparison (score one candidate against multiple open roles)

### Team Features

- **V2-TEAM-01**: Cloud sync of candidate evaluations across team members
- **V2-TEAM-02**: Shared JD library across a recruiting team

### Notifications

- **V2-NOTIF-01**: Email digest of L3 candidates ready to contact
- **V2-NOTIF-02**: Slack integration for team candidate alerts

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-send messages without recruiter review | Legal/compliance risk; recruiter must always review before sending |
| Backend / cloud database | Increases infrastructure complexity; out of scope for v1 |
| User accounts / authentication | Not needed without backend |
| Bulk profile scraping | LinkedIn ToS violation; extension reads one profile at a time |
| LinkedIn API integration | No official public API for profile data; DOM-only approach |
| Real-time streaming AI responses | Added complexity; deferred to v2 |
| Mobile app | Browser extension only |
| Video / AI avatar outreach | Out of scope for v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SET-01 – SET-06 | Phase 1: Foundation | Pending |
| PARSE-01 – PARSE-06 | Phase 2: Profile Parsing | Pending |
| SCORE-01 – SCORE-08 | Phase 3: Scoring Pipeline | Pending |
| STORE-01 – STORE-03 | Phase 3: Scoring Pipeline | Pending |
| MSG-01 – MSG-06 | Phase 4: Output Layer | Complete (04-03, 2026-03-10) |
| CSV-01 – CSV-05 | Phase 4: Output Layer | Complete (04-03, 2026-03-10) |
| SCHED-01 – SCHED-04 | Phase 5: Scheduling and Notifications | Pending |
| XBROW-01 – XBROW-03 | Phase 6: Safari Packaging and Cross-Browser Verification | Pending |

**Coverage:**
- v1 requirements: 41 total
- Mapped to phases: 41
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-06 after roadmap creation*
