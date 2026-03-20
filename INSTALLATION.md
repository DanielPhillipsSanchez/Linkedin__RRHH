# Installation Guide — EvolvrScreener

This guide walks you through installing the extension on your computer step by step. You don't need any technical knowledge to follow it.

---

## Before you start

You need to have **Google Chrome** installed. If you don't have it, download it from [google.com/chrome](https://www.google.com/chrome/) and install it like any other program.

---

## Step 1 — Receive the extension folder

The support team will share the **`chrome-mv3`** folder with you directly (via USB, shared folder, or email). You don't need to download anything from the internet.

Once you have the folder, save it somewhere permanent on your computer (for example, in **Documents**). Do not move or delete it after installing.

> If you were sent a `.zip` file, extract it first:
> - **On Windows**: right-click → "Extract All" → "Extract"
> - **On Mac**: double-click the `.zip` file

---

## Step 2 — Open the extensions screen in Chrome

1. Open **Google Chrome**.
2. In the address bar, type exactly this and press **Enter**:

```
chrome://extensions/
```

3. A screen with the title "Extensions" will open.

---

## Step 3 — Enable "Developer mode"

In the top right corner of that screen you will see a toggle that says **"Developer mode"**.

- If the toggle is off (gray), click it to turn it on (it will turn blue).
- If it's already blue, you don't need to do anything.

---

## Step 4 — Load the extension

1. Click the **"Load unpacked"** button that will appear in the top left.
2. A window to select a folder will open.
3. Find and select the **`chrome-mv3`** folder you received in Step 1.
4. Click **"Select Folder"**.

If everything went well, the extension will appear in the list with the name **"EvolvrScreener"** and no red error messages.

---

## Step 5 — Pin the extension to the Chrome toolbar

To always have the extension within reach:

1. Find the **puzzle piece** icon in the top right corner of Chrome (next to the address bar).
2. Click it.
3. Find **"EvolvrScreener"** in the list.
4. Click the **pin** icon that appears to the right of the name.

The extension icon will now be visible in your Chrome toolbar for use at any time.

> The extension comes with the access key already configured. You don't need any additional setup steps before using it.

---

## Step 6 — Create your first Evolver Search

Before evaluating candidates, you need to tell the extension which position you are hiring for.

1. Click the extension icon in the Chrome toolbar.
2. In the top right corner of the popup, click the **"Settings"** link.
3. The settings page will open.
4. Find the **"Job Requisition Form"** section.
5. Enter the position name in the **"Title"** field (for example: "Data Analyst").
6. Paste the full text of the job posting in the description field.
7. Click **"Add offer"**.
8. Next, add the skills you are looking for in the candidate:
   - Enter each skill name (for example: "Excel", "Python", "SQL").
   - Indicate whether it is **Required** or **Nice to have**.
   - Click **"Add"** for each one.
9. Go up to the **"New Evolver Search"** section and check the circle (radio button) next to the position name to activate it.

> You can also import the job posting directly from an **Excel, CSV, Word, or PDF** file instead of pasting it manually.

---

## You're all set! Here's how to use the extension every day

1. Open LinkedIn in Chrome and navigate to a candidate's profile.
2. Click the extension icon (the Evolvr logo in the Chrome toolbar).
3. Click **"Evaluate"** — the button will disable while processing.
   > **Wait time**: evaluation takes between **10 and 20 seconds**. It first analyzes skills by keywords and then consults the AI (Claude AI). **Do not click again** while waiting — the button will re-enable on its own when the result is ready.
4. The extension will show you the candidate's level and a summary of their skills:
   - **High Fit** — excellent match, contact immediately
   - **Good Fit** — good match, contact as second priority
   - **Partial Fit** — worth exploring, contact after 7 days
   - **Discarded** — does not meet minimum requirements
5. If you close the popup and reopen it on the same profile, the previous result is automatically restored.
6. To change the language of the interface and analysis, click the 🇨🇴 🇺🇸 flags in the top right corner of the popup. The active language flag appears highlighted in orange.
   > **Wait time**: translation can take between **15 and 20 seconds**. **Do not click the flags multiple times** while waiting — the result will appear on its own.
7. If the candidate was not discarded, you can click **"Draft message"** to generate a personalized outreach message.
   > **Wait time**: the message takes between **5 and 10 seconds** to generate. Do not click multiple times — wait for the text to appear on screen.
8. When you finish your day, export all candidates to an Excel file by clicking **"Export CSV"**.
9. If you want to start fresh the next day, click **"Clear candidates"** to wipe the list.

---

## Frequently asked questions

**I don't see the extension icon in Chrome**
Follow Step 5 to pin it to the toolbar.

**The extension does not detect the candidate's profile**
Make sure you are on a LinkedIn URL with the format `linkedin.com/in/candidate-name` and wait 2 seconds after the page loads.

**The candidate's score seems low even though they have good experience**
Check that the skills marked as **Required** are truly critical for the role. The extension assigns 80% of the score to those skills. Role-implied skills (for example: numpy for a Data Scientist) are recognized automatically even if they are not listed on the LinkedIn profile.

**The result disappeared after closing and reopening the popup**
If you navigated to a different profile, the result changes to the new profile. If you are still on the same profile, the result should restore automatically. If it doesn't appear, click "Evaluate" again.

**I moved or deleted the `chrome-mv3` folder by mistake**
Ask the support team to share the folder again and repeat steps 4 and 5.

---

*For any technical issues, contact your organization's support team.*
