# LinkedIn HHRR Candidate Screener

## What This Is

A Chrome and Safari browser extension for HR/HHRR recruiters that loads any LinkedIn profile, scores the candidate against a saved job description using hybrid skill matching (keyword analysis + Claude AI), and categorizes them into hiring tiers. The extension generates tailored outreach messages and manages tiered contact scheduling — all without requiring a backend or user account.

## Core Value

A recruiter can open any LinkedIn profile and know within seconds whether to pursue the candidate, which tier they fall into, and have a ready-to-send personalized message — all in one click.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Extension ru
ns on Chrome and Safari
- [ ] Recruiter can save one or more job descriptions inside the extension
- [ ] Extension parses skills and experience from the active LinkedIn profile page
- [ ] Extension scores candidate skills against selected JD using hybrid matching (keyword + Claude API)
- [ ] Candidate is categorized into a hiring tier based on match score
- [ ] Layer 1: 80%+ match — proceed to hiring process
- [ ] Layer 2: 71–79% match — proceed as second priority
- [ ] Layer 3: 60–70% match — contact at least 1 week after L1/L2
- [ ] Rejected: below 60% — do not continue
- [ ] Extension generates a tailored outreach message for Layer 1 and Layer 2 candidates
- [ ] Extension generates a tailored outreach message for Layer 3 candidates (with delayed contact note)
- [ ] Recruiter reviews generated message in the extension panel before sending
- [ ] Recruiter can send message via LinkedIn from within the extension
- [ ] Evaluated candidates are exportable to CSV with tier, score, and contact date
- [ ] Layer 3 candidates show a "Contact After" date (7 days from evaluation) in the CSV export
- [ ] Extension sets a browser notification 7 days after a Layer 3 candidate is evaluated

### Out of Scope

- Backend / cloud database — no server infrastructure for v1
- User accounts / team sharing — single-device local storage only
- Auto-send messages without recruiter review — recruiter always reviews first
- Real-time LinkedIn API integration — extension reads the DOM of the profile page
- Mobile app — browser extension only

## Context

- Target users: HHRR recruiters who work LinkedIn profiles daily to source candidates
- LinkedIn does not have an official extension API; the extension will read profile data from the DOM
- AI matching uses the Anthropic Claude API — recruiter provides their own API key in extension settings
- Chrome and Safari both support the WebExtensions API; Safari requires additional Xcode packaging
- No backend means candidate history lives in browser local storage and CSV exports
- Layer 3 timing enforcement uses browser Notifications API (requires user permission grant)

## Constraints

- **Tech Stack**: WebExtensions API (MV3) for Chrome; Safari Web Extension wrapper via Xcode for Safari
- **AI Provider**: Anthropic Claude API — key stored locally in extension settings, never transmitted elsewhere
- **Privacy**: All candidate data stored locally in chrome.storage.local / browser.storage.local
- **LinkedIn ToS**: Extension reads DOM only — no scraping via LinkedIn API, no automated actions without recruiter confirmation
- **No Backend**: v1 must work fully offline except for Claude API calls during matching

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|------------|
| Hybrid matching (keyword + Claude) | Keywords handle clear matches cheaply; Claude handles ambiguous skills, synonyms, and soft skills | — Pending |
| Chrome + Safari v1 | Both are primary recruiter browsers; WebExtensions API overlap makes it feasible | — Pending |
| No backend for v1 | Reduces infrastructure cost and complexity; CSV export is sufficient for solo recruiters | — Pending |
| Recruiter reviews before sending | Ensures message quality and compliance — auto-send without review was explicitly excluded | — Pending |
| Layer 3 = 7-day delay | Ensures L1/L2 candidates get first-mover advantage; CSV + browser notification enforces this | — Pending |

---
*Last updated: 2026-03-06 after initialization*
