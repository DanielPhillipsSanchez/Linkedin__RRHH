# EvolvrScreener

Browser extension for HR teams that evaluates LinkedIn candidates in seconds, classifies them by fit level, and generates personalized outreach messages — all directly from the LinkedIn profile without leaving the page.

---

## Table of Contents

1. [What this extension does](#what-this-extension-does)
2. [Prerequisites](#prerequisites)
3. [Installation in Chrome](#installation-in-chrome)
4. [Initial setup](#initial-setup)
5. [Daily usage step by step](#daily-usage-step-by-step)
6. [Fit level classification system](#fit-level-classification-system)
7. [Language and translations](#language-and-translations)
8. [Message generation](#message-generation)
9. [Export candidates to CSV](#export-candidates-to-csv)
10. [Project structure](#project-structure)
11. [Local development](#local-development)
12. [Frequently asked questions](#frequently-asked-questions)
13. [Manual testing instructions](#manual-testing-instructions)

---

## What this extension does

EvolvrScreener automates the recruiter workflow:

1. **Open a LinkedIn profile** — the extension automatically extracts the candidate's skills, experience, education, and summary.
2. **Evaluate the candidate** — compares their data against a saved job requisition form, using keyword matching + artificial intelligence (Claude AI) to resolve synonyms and role-implied skills.
3. **Classify by fit level** — assigns the candidate a level (High Fit, Good Fit, Partial Fit, or Discarded) based on the match percentage.
4. **Generate a personalized message** — automatically creates an outreach message tailored to the candidate's fit level.
5. **Export to CSV** — allows downloading a file with all evaluated candidates, including scores, skills, and interview questions.

---

## Prerequisites

| Requirement | Details |
|-------------|---------|
| **Browser** | Google Chrome (version 113 or higher) |
| **LinkedIn Account** | Active LinkedIn session |
| **Claude API Key** | Pre-configured in the distributed build. For development, obtain it at [console.anthropic.com](https://console.anthropic.com/) |
| **Node.js** | Version 18+ (development only, not required for regular use) |

---

## Installation in Chrome

### Option A: Load from build folder (production use)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (top right corner)
3. Click **"Load unpacked"**
4. Select the folder: `linkedin-hhrh-screener/.output/chrome-mv3/`
5. The **EvolvrScreener** extension will appear in the Chrome toolbar

### Option B: Build from source

```bash
cd linkedin-hhrh-screener
pnpm install
pnpm wxt build
```

Then load the `.output/chrome-mv3/` folder following the steps in Option A.

> To include a pre-configured API key in the build, add `VITE_ANTHROPIC_API_KEY=sk-ant-...` to the `.env` file (which is in `.gitignore` and is never pushed to GitHub) before building.

---

## Initial setup

### 1. Create a Job Requisition Form

1. Click the extension icon in the Chrome toolbar
2. Click **"Settings"** (link in the top right corner of the popup)
3. On the settings page, find the **"Job Requisition Form"** section
4. Enter a **title** for the position (e.g., "Senior Backend Engineer")
5. Paste the **full text** of the job description, or import from a file (Excel, CSV, Word, or PDF)
6. Click **"Add offer"**
7. Once created, add the **relevant skills**:
   - Enter the skill name (e.g., "Python", "React", "SQL")
   - Select its weight: **Required** or **Nice to have**
   - Click **"Add"**
8. Repeat for all skills in the position

### 2. Select the active search

- In the **"New Evolver Search"** section, check the radio button next to the offer you want to use
- You can change the active offer at any time

### 3. API Key (only if the build does not include one)

If the build does not have a pre-configured API key:

1. On the **Settings** page, find the **"Claude API Key"** section
2. Paste your Anthropic key in the corresponding field
3. Click **"Save and verify"** — a green confirmation should appear

---

## Daily usage step by step

### Evaluate a candidate

1. **Navigate to a LinkedIn profile** (e.g., `linkedin.com/in/candidate-name`)
2. Wait 1-2 seconds for the extension to extract the profile data
3. Click the **EvolvrScreener icon** in the Chrome toolbar
4. If you already evaluated this profile before, the result is automatically restored
5. Click **"Evaluate"** — the button will disable while processing
6. **Wait time: 10–20 seconds.** The extension performs keyword matching and then queries Claude AI. Do not click again — the result will appear automatically.
7. You will see the result:
   - **Fit level** (High Fit / Good Fit / Partial Fit / Discarded) with color indicator
   - **Match percentage**
   - **Experience level** (Junior / Mid / Senior / Staff)
   - **Matching skills** — skills the candidate meets
   - **Missing skills** — required skills not found
   - **Claude analysis** — justification for the assigned level
   - **Interview alerts** — specific technical questions to verify the profile

### Change language

- Click the **🇨🇴 🇺🇸** flags in the top right corner of the popup
- The active language flag is highlighted with a dark orange border
- When changing language, the analysis and alerts are automatically translated. **This process can take between 15 and 20 seconds — do not click the flags multiple times while waiting**, the result will appear on its own.
- If you close and reopen the popup, the saved result is displayed and you can translate it without re-evaluating

### Generate and send an outreach message

1. After evaluating (if the candidate is NOT Discarded), the **"Outreach Message"** section appears
2. Click **"Draft message"** — **Wait time: 5–10 seconds.** Do not click multiple times.
   - **High Fit**: direct and enthusiastic tone
   - **Good Fit**: exploratory tone
   - **Partial Fit**: future opportunity tone
3. **Edit the message** in the text area if you want to adjust it
4. Use the action buttons:
   - **Copy**: copies the message to the clipboard
   - **Open on LinkedIn**: opens the LinkedIn messaging window with the candidate pre-selected
   - **Mark as sent**: saves the message text and send date in the candidate's record

### Export candidates to CSV

1. In the popup, click **"Export CSV"**
2. A file `hhrh-candidates-YYYY-MM-DD.csv` will download with all tracking columns

---

## Fit level classification system

| Level | Range | Meaning | Recommended action |
|-------|-------|---------|-------------------|
| **High Fit** | 75% or more | Excellent match | Contact immediately, high priority |
| **Good Fit** | 63% - 74% | Good match with minor gaps | Contact as second priority |
| **Partial Fit** | 50% - 62% | Partial match, worth exploring | Contact after 7 days (prioritize the above) |
| **Discarded** | Less than 50% | Does not meet minimum requirements | Do not continue with this candidate |

### How the score is calculated

1. **Keyword matching**: compares the candidate's skills with the position's skills (including bidirectional substrings, e.g., "React" matches "React.js")
2. **Role-implied skills**: Claude infers standard skills for the role even if not listed. For example, a Data Scientist with years of experience is assumed to know numpy, pandas, and scikit-learn. Git is assumed for any technical role without exception.
3. **Refinement with Claude AI**: for non-matching skills, Claude analyzes synonyms, related tools, and work experience.
4. **Two-bucket formula (80/20)**:
   - **Required** skills → 80% of the final score
   - **Nice to have** skills → 20% of the final score
5. **Result**: thresholds are the same regardless of offer size (no penalty for offers with many skills).

---

## Language and translations

The extension fully supports **Spanish** and **English**:

- The language selector shows the 🇨🇴 (Spanish) and 🇺🇸 (English) flags in the popup header
- The active language flag is highlighted with a dark orange border
- Changing the language translates the interface, Claude analysis, and interview alerts. **Translation can take between 15 and 20 seconds — do not click the flags multiple times while waiting.**
- The evaluation is generated in the active language at the time of clicking "Evaluate"
- If you close the popup and reopen it on the same profile, the result is restored and you can translate it without re-evaluating

---

## Message generation

EvolvrScreener generates personalized messages using Claude AI. The tone varies by level:

| Level | Message tone | Example focus |
|-------|-------------|--------------|
| **High Fit** | Direct and enthusiastic | "Your experience in X is exactly what we're looking for..." |
| **Good Fit** | Exploratory | "I'd like to learn more about your experience in..." |
| **Partial Fit** | Future opportunity | "We have roles in development that could align with your profile..." |

Messages:
- Use the candidate's name
- Reference specific experience from their profile
- Are under 300 words
- Are fully editable before sending
- Are never sent automatically — the recruiter always reviews and decides

---

## Export candidates to CSV

The CSV file is completely in Spanish and includes all the information needed for reports and follow-up:

| Column | Description |
|--------|-------------|
| Nombre | Candidate's full name |
| Telefono | Phone number (if manually entered) |
| Titulo | LinkedIn headline |
| URL de LinkedIn | Direct link to profile |
| Nivel | Assigned level (Encaje alto / Buen encaje / Encaje parcial / Descartado) |
| Puntuacion (%) | Match percentage with the offer |
| Habilidades coincidentes | Skills the candidate meets (separated by `;`) |
| Habilidades faltantes | Required skills not found (separated by `;`) |
| Fecha de evaluacion | Date in YYYY-MM-DD format |
| Contactar despues de | Suggested date for Partial Fit (evaluation + 7 days) |
| Mensaje enviado | Text of the message marked as sent |
| Pregunta de verificacion N | Technical interview question for alert N |
| Respuesta esperada N | What a qualified candidate would answer to that question |

> The question and answer columns are generated dynamically: if the candidate has 3 alerts, 6 additional columns will appear.

---

## Project structure

```
linkedin-hhrh-screener/
  entrypoints/
    background.ts          # Service worker: handles API calls, scoring, messages
    content.ts             # Content script: extracts data from LinkedIn profile
    popup/
      index.html           # Extension popup UI
      index.ts             # Popup logic (evaluate, messages, CSV, translations)
      style.css            # Popup styles
    options/
      index.html           # Settings page
      index.ts             # Settings logic
  src/
    i18n.ts                # ES/EN translations for the entire interface
    parser/
      parser.ts            # Data extraction from LinkedIn DOM
      selectors.ts         # Centralized CSS selectors
      types.ts             # Candidate data types
    scorer/
      scorer.ts            # Keyword matching engine
      tiers.ts             # Fit level assignment
      claude.ts            # Refinement with Claude AI
      messenger.ts         # Outreach message generation
    shared/
      messages.ts          # Message types between components
      csv.ts               # CSV generation and download
    storage/
      schema.ts            # Local storage schema
      storage.ts           # CRUD operations on browser.storage.local
  tests/                   # Unit tests (Vitest)
```

---

## Local development

### Install dependencies

```bash
cd linkedin-hhrh-screener
pnpm install
```

### Run in development mode (hot reload)

```bash
pnpm wxt dev
```

This opens Chrome with the extension loaded automatically. Code changes are reflected instantly.

### Run tests

```bash
pnpm vitest run
```

### Build for production

```bash
pnpm wxt build
```

Output will be in `.output/chrome-mv3/`. To include a pre-configured API key, add `VITE_ANTHROPIC_API_KEY=sk-ant-...` to `.env` before building.

---

## Frequently asked questions

### The extension does not detect the LinkedIn profile

- Make sure you are on a URL with the format `linkedin.com/in/name`
- Wait for the page to load completely (1-2 seconds)
- If you navigated from another profile, the extension re-extracts automatically

### The "Evaluate" button shows an error

| Error on screen | Solution |
|-----------------|---------|
| "No profile data" | Navigate to a LinkedIn profile and wait for it to load |
| "No API key" | Go to Settings and configure your Claude key |
| "No active offer" | Go to Settings and select a job requisition form |
| "Active offer has no skills" | Add skills to the selected offer |
| "Background service not ready" | Reload the extension from `chrome://extensions/` |

### The score seems low

- Verify that the skills in the offer match the terms LinkedIn uses (e.g., "JS" vs "JavaScript")
- **Required** skills represent 80% of the score — make sure they are correctly marked
- Claude infers typical role skills (git for any technical position, numpy for Data Scientists, etc.) even if not listed
- If the offer has many Nice to have skills the candidate doesn't list, the impact is minimal thanks to the 80/20 formula

### Where is candidate data stored?

All data is stored locally in `chrome.storage.local` (within your browser). It is not sent to any server except the Anthropic API for analysis. Records automatically expire after 90 days.

### Can I use the extension in Safari?

The extension is currently designed and validated for **Google Chrome**. Safari compatibility is not in the current scope.

---

## Privacy and security

- **No backend**: all data is stored locally in your browser
- **Secure API Key**: the Claude key is only used from the service worker, never exposed to page content
- **No mass scraping**: the extension reads one profile at a time, only when the recruiter navigates to it
- **Automatic expiration**: candidate records expire after 90 days
- **Mandatory review**: no message is sent without the recruiter's explicit review and approval

---

## Manual testing instructions

Follow these steps in order to verify the extension works correctly end to end.

### Step 1: Build and load the extension

```bash
cd ~/Documents/Linkedin__RRHH/linkedin-hhrh-screener
pnpm wxt build
```

1. Open `chrome://extensions/`
2. Enable **Developer mode** (toggle at the top right)
3. Click **"Load unpacked"** → select the `.output/chrome-mv3/` folder
4. **Verify**: the extension appears as **"EvolvrScreener"** with no errors (no red "Errors" button)

### Step 2: Configure Settings

1. Click the extension icon → click **"Settings"**
2. **API Key**: if not pre-configured, paste your key → click "Save and verify" → should show green confirmation
3. **Create offer**: in "Job Requisition Form", title = "Test Engineer", text = any description → click "Add offer"
4. **Add skills**: add 3-4 skills (e.g., "Python" required, "React" required, "Docker" nice to have) → click "Add" for each
5. **Select active search**: in "New Evolver Search", check the radio button for the offer you created

### Step 3: Evaluate a candidate

1. Navigate to any public LinkedIn profile (e.g., `linkedin.com/in/someone`)
2. Wait 2 seconds
3. Click the extension icon → click **"Evaluate"**
4. **Verify**:
   - [ ] A **fit level** is shown (High Fit / Good Fit / Partial Fit / Discarded) with color
   - [ ] The **match percentage** is shown
   - [ ] The **experience level** is shown (Junior / Mid / Senior / Staff)
   - [ ] A list of **matching skills** is shown
   - [ ] A list of **missing skills** is shown
   - [ ] The **Claude analysis** is shown
   - [ ] **Interview alerts** (technical questions) are shown if there are red flags
   - [ ] The candidate appears in **"Recent Candidates"** at the bottom of the popup

### Step 4: Result persistence

1. Close the popup
2. Reopen it on the same LinkedIn profile
3. **Verify**: the candidate's result is displayed automatically without re-evaluating

### Step 5: Language change

1. With a result visible, click the 🇺🇸 flag
2. **Verify**:
   - [ ] The US flag is highlighted with an orange border
   - [ ] The interface changes to English
   - [ ] The analysis and alerts are translated (15–20 seconds — do not click the flags multiple times)
3. Click the 🇨🇴 flag to switch back to Spanish
4. **Verify**: the original Spanish result is restored without a new API call

### Step 6: Generate outreach message

*(Only if the candidate was NOT Discarded)*

1. The **"Outreach Message"** section should appear below the result
2. Click **"Draft message"** → wait 5–10 seconds (do not click again while waiting)
3. **Verify**:
   - [ ] A personalized message appears in the text area
   - [ ] The message mentions the candidate's name
   - [ ] The tone matches the level (enthusiastic for High Fit, exploratory for Good Fit, future for Partial Fit)
4. **Edit**: modify the text (must be editable)
5. Click **"Copy"** → paste into a text editor → confirm it was copied correctly
6. Click **"Open on LinkedIn"** → should open a new tab in LinkedIn messaging
7. Click **"Mark as sent"** → should show a green confirmation

### Step 7: Navigate to another profile (SPA detection)

1. Without closing the tab, navigate to a **second LinkedIn profile**
2. Wait 2 seconds
3. Click the icon → **"Evaluate"** again
4. **Verify**:
   - [ ] Results are **different** from the previous candidate
   - [ ] The new candidate's name appears correctly
   - [ ] There are now **2 candidates** in "Recent Candidates"

### Step 8: Export CSV

1. In the popup, click **"Export CSV"**
2. **Verify**:
   - [ ] A file `hhrh-candidates-YYYY-MM-DD.csv` is downloaded
   - [ ] Open it in Excel/Google Sheets — columns should be in Spanish: Nombre, Telefono, Titulo, URL de LinkedIn, Nivel, Puntuacion (%), Habilidades coincidentes, Habilidades faltantes, Fecha de evaluacion, Contactar despues de, Mensaje enviado
   - [ ] If the candidate has alerts, additional columns should appear: "Pregunta de verificacion 1", "Respuesta esperada 1", etc.
   - [ ] Levels appear as "Encaje alto", "Buen encaje", "Encaje parcial" or "Descartado"

### Step 9: Verify controlled errors

1. Go to Settings → delete the API key → save
2. Evaluate a candidate → should show: **"No Claude API key — add it in Settings"**
3. Re-add the key → deactivate the active offer
4. Evaluate → should show: **"No active offer — select one in Settings"**

> If all steps pass correctly, the extension is validated and ready for use.

---

*Developed for HR teams — EvolvrScreener v2*
