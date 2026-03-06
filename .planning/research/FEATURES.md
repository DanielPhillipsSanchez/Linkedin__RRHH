# Feature Landscape

**Domain:** LinkedIn HR/HHRR Candidate Screening Browser Extension
**Researched:** 2026-03-06
**Confidence note:** WebSearch and Bash were unavailable during this research session. Findings are drawn from training knowledge of the LinkedIn recruiter extension ecosystem (tools like LinkedIn Recruiter, Dux-Soup, Wiza, Hunter.io, Skrapp, PhantomBuster, and Gem). Competitive analysis is MEDIUM confidence; project-specific feature prioritization is HIGH confidence based on PROJECT.md requirements.

---

## Table Stakes

Features users expect from any LinkedIn screening tool. Missing = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Profile data parsing from active LinkedIn page | Every competitor does this; it's the foundation — without it the tool does nothing | High | DOM-scraping is fragile; LinkedIn changes markup frequently. Must parse: name, headline, current role, experience history, skills section, education. |
| Job description storage inside the extension | Recruiter needs context to score against; no JD = no screening | Low-Med | Must support multiple JDs. CRUD: create, rename, delete. Persisted in chrome.storage.local. |
| Candidate-to-JD match scoring | Core value proposition; users expect a numeric signal | High | Hybrid keyword + AI approach (per PROJECT.md). Score must be explainable — not a black box number. |
| Tier classification with clear labels | Recruiters think in buckets, not decimals. "Proceed / Second priority / Delayed / Reject" maps to existing mental models | Low | Tier thresholds (L1: 80%+, L2: 71-79%, L3: 60-70%, Rejected: <60%) are already defined in PROJECT.md. |
| Candidate history / log within the extension | Recruiter needs to recall what they decided about a profile they visited yesterday | Med | Stored in chrome.storage.local. Must show profile name, tier, date evaluated, JD used. |
| CSV export of evaluated candidates | Recruiters live in spreadsheets; this is their data escape hatch | Med | Must include: name, LinkedIn URL, tier, score, JD name, evaluation date, contact-after date for L3. |
| Outreach message generation | Personalized cold messages are the hardest part of the recruiter's job; every modern tool attempts this | High | Claude API call. Message must reference specific skills/experience from the profile. Two variants: standard (L1/L2) and delayed-contact framing (L3). |
| Message review panel before sending | Non-negotiable trust feature — auto-send without review is both a ToS risk and a quality risk | Low | Editable text area. "Copy to clipboard" and "Send via LinkedIn" options. |
| Settings page for API key entry | Claude API key must be stored locally and never transmitted elsewhere | Low | Standard extension options page. Key stored in chrome.storage.local, masked in UI. Validate key on save. |
| Extension popup / sidebar UI on profile pages | Recruiter expects the tool to appear automatically when on a LinkedIn profile | Med | content_script injection on linkedin.com/in/* URLs. Side panel (Chrome's sidePanel API) or popup. |

---

## Differentiators

Features that set this product apart. Not universally expected, but create real competitive advantage when done well.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Hybrid skill matching (keyword + Claude AI) | Pure keyword matching misses synonyms and transferable skills; pure AI is slow and expensive. Hybrid is faster and cheaper while still catching nuanced matches | High | Run keyword pass first; only invoke Claude for ambiguous or borderline candidates. Reduces API cost significantly. |
| Tiered contact scheduling with 7-day L3 delay | Enforces recruiter discipline — L1/L2 candidates get first-mover advantage; L3s don't crowd out hot leads | Med | Browser Notifications API fires 7 days after L3 evaluation. CSV "Contact After" date column provides offline backup. |
| Score explainability (why this score) | Recruiter can tell a hiring manager why a candidate was tiered. Black-box AI scores erode trust | Med | Claude response should return matched skills, missing skills, and a brief rationale — not just a number. Show matched/missing breakdown in UI. |
| Multiple saved JDs with per-candidate JD selection | Recruiter works multiple roles simultaneously; single-JD tools force them to switch context manually | Low-Med | JD switcher in the panel. Each evaluated candidate record stores which JD was used. |
| Fully local / no account required | Privacy-first: no candidate data leaves the device except Claude API calls during matching. Zero onboarding friction | Low (arch) | This is a trust differentiator with privacy-conscious HR teams and smaller companies without enterprise tooling budgets. |
| DOM-based parsing (no LinkedIn API dependency) | Works without LinkedIn's permission or API access; not rate-limited by LinkedIn's platform | High (maintenance) | Fragile long-term but gives immediate access to all profile data LinkedIn renders. Must have a graceful fallback when parsing fails. |
| L3 "delayed contact" message framing | Acknowledges the candidate is good but not the immediate priority; keeps the relationship warm without being dishonest | Low (copy) / Med (AI prompt) | Requires a distinct Claude prompt variant that frames timing naturally. Most tools treat all messages identically. |

---

## Anti-Features

Features to deliberately NOT build. Explicitly excluded from scope.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Auto-send messages without recruiter review | LinkedIn ToS violation risk; destroys message quality; legal liability in some jurisdictions for unsolicited automated outreach | Always require explicit recruiter click to send. Copy-to-clipboard as fallback. |
| Backend / cloud database | Adds infrastructure cost, maintenance burden, privacy risk, and account management complexity for v1 | chrome.storage.local + CSV export covers solo recruiter needs entirely |
| Team sharing / multi-user sync | Requires auth, backend, conflict resolution, and GDPR-level data handling — this is a different product | Out of scope for v1. If needed later, export/import JSON as a manual sharing workaround. |
| LinkedIn API / official integration | LinkedIn aggressively blocks API-based scraping and revokes partner access. DOM reading is more reliable for this use case | Read the DOM; treat LinkedIn like any other webpage |
| Bulk profile processing / batch scraping | Violates LinkedIn ToS; risks account bans for the recruiter. Also shifts the product from "assistive tool" to "scraper" | Process one profile at a time, on-demand, when recruiter visits the page |
| Real-time LinkedIn inbox integration | Requires LinkedIn API access which is not available. Attempting to inject into LinkedIn's messaging DOM is fragile and likely ToS-violating | Provide message text for recruiter to paste/send manually, or trigger LinkedIn's native message compose via URL scheme |
| Candidate ranking across tiers (cross-profile comparison) | Requires a centralized score index; adds complexity; encourages gaming the tier thresholds | Tiers are the comparison mechanism. Let CSV export serve cross-candidate analysis needs |
| Payment / subscription gating in v1 | Adds friction, requires payment infrastructure, and delays validation of the core product hypothesis | Ship free to validate; monetization decisions come after product-market fit evidence |
| Mobile app | Browser extension architecture is incompatible with mobile; LinkedIn mobile app does not support extensions | Browser-only for v1 |
| AI model selection / model switching | Creates support surface, version complexity, and prompt engineering debt across multiple providers | Lock to Claude API for v1. API key is user-supplied so no vendor lock-in concern. |

---

## Feature Dependencies

```
Settings (API key) → AI Scoring (Claude calls require key)
Profile Parsing → AI Scoring (scoring requires parsed profile data)
Profile Parsing → Message Generation (message requires profile context)
JD Storage → AI Scoring (scoring requires a selected JD)
JD Storage → Message Generation (message is JD-context-aware)
AI Scoring → Tier Classification (tier is derived from score)
Tier Classification → L3 Scheduling (7-day notification only triggers for L3)
Tier Classification → Message Generation (message variant depends on tier)
Profile Parsing + Tier Classification + AI Scoring → Candidate History (log entry requires all three)
Candidate History → CSV Export (export reads from candidate log)
L3 Scheduling → Browser Notifications (requires Notifications API permission)
Message Generation → Message Review Panel (panel displays generated message)
Message Review Panel → LinkedIn Send (send action is triggered from review panel)
```

**Critical path:** Settings → JD Storage → Profile Parsing → AI Scoring → Tier Classification

Everything downstream of Tier Classification (messages, scheduling, export) is blocked until the scoring pipeline works end-to-end.

---

## MVP Recommendation

**Must ship in v1 (blocking):**
1. Settings page with Claude API key entry and validation
2. JD storage (create, select, delete — minimum 1 JD)
3. Profile parsing from LinkedIn DOM (name, headline, skills, experience)
4. Hybrid keyword + Claude scoring against selected JD
5. Tier classification display (L1/L2/L3/Rejected) with score
6. Score explainability panel (matched skills, missing skills, rationale)
7. Candidate history log (stored locally)
8. Message generation (tier-appropriate variant)
9. Message review panel with copy-to-clipboard
10. CSV export of candidate history

**Ship in v1 but lower risk (non-blocking to test core loop):**
- L3 browser notification at 7-day mark (requires Notifications API permission grant; degrade gracefully if denied)
- LinkedIn message compose trigger (URL scheme or DOM inject — validate feasibility separately)

**Defer to v2:**
- Multiple JD management UI polish (rename, reorder)
- Import/export of candidate history as JSON (manual team sharing workaround)
- Prompt tuning UI for message tone/style customization
- Analytics: tier distribution across all evaluated candidates

---

## Feature Complexity Reference

| Complexity | Meaning |
|------------|---------|
| Low | 1-3 days, well-understood implementation path |
| Med | 1-2 weeks, some unknowns or integration surface |
| High | 2+ weeks, significant fragility, external dependencies, or research needed |

---

## Sources

- Project requirements: `/Users/danielphillips/Documents/Linkedin__RRHH/.planning/PROJECT.md`
- Domain knowledge: LinkedIn recruiter extension ecosystem (Dux-Soup, Wiza, Gem, PhantomBuster, LinkedIn Recruiter Lite feature sets) — MEDIUM confidence, based on training data through August 2025
- LinkedIn ToS constraints: DOM-reading vs API distinction is well-established in the extension development community — MEDIUM confidence
- WebExtensions API capabilities (sidePanel, storage.local, Notifications API): HIGH confidence, stable APIs
- Note: WebSearch was unavailable during this session. Competitive feature claims should be verified against current tools before roadmap finalization.
