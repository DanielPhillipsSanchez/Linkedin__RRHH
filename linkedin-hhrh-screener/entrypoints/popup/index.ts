import { getStorageUsageBytes, STORAGE_QUOTA_BYTES, getAllCandidates, clearAllCandidates, getLang, setLang, getActiveJdId } from '../../src/storage/storage';
import type { EvaluateResult, GenerateMessageResult, SaveMessageResult, TranslateResultResult } from '../../src/shared/messages';
import type { Lang } from '../../src/i18n';
import { T } from '../../src/i18n';
import { getTierLabels } from '../../src/scorer/tiers';
import { candidatesToCsv, downloadCsv } from '../../src/shared/csv';

let currentCandidateId: string | null = null;
let currentProfileUrl: string | null = null;
let currentLang: Lang = 'es';
let lastResult: EvaluateResult | null = null;
// The original evaluation result, always in the evaluation language — never overwritten
let originalResult: EvaluateResult | null = null;
let originalResultLang: Lang = 'es';
// Cache of the translated version (the non-original language) to avoid redundant API calls
let translatedResultCache: EvaluateResult | null = null;

// ---- Translation helpers ----

function t() { return T[currentLang]; }

function applyStaticTranslations(): void {
  const tr = t();

  // Header
  const settingsLink = document.getElementById('settings-link');
  if (settingsLink) settingsLink.textContent = tr.settings;

  const flagEs = document.getElementById('flag-es');
  const flagEn = document.getElementById('flag-en');
  if (flagEs && flagEn) {
    flagEs.classList.toggle('lang-flag--active', currentLang === 'es');
    flagEn.classList.toggle('lang-flag--active', currentLang === 'en');
  }

  // Evaluate button — only if not in loading state
  const evalBtn = document.getElementById('evaluate-btn') as HTMLButtonElement;
  if (evalBtn && !evalBtn.disabled) evalBtn.textContent = tr.evaluate;

  // Red flags title
  const rfTitle = document.getElementById('red-flags-title');
  if (rfTitle) rfTitle.textContent = tr.redFlagsTitle;

  // Message section
  const contactTitle = document.getElementById('contact-message-title');
  if (contactTitle) contactTitle.textContent = tr.contactMessage;

  const generateBtn = document.getElementById('generate-msg-btn') as HTMLButtonElement;
  if (generateBtn && !generateBtn.disabled) generateBtn.textContent = tr.draftMessage;

  const msgTextarea = document.getElementById('message-textarea') as HTMLTextAreaElement;
  if (msgTextarea) msgTextarea.placeholder = tr.messagePlaceholder;

  const copyBtn = document.getElementById('copy-msg-btn') as HTMLButtonElement;
  if (copyBtn) copyBtn.textContent = tr.copy;

  const linkedinBtn = document.getElementById('open-linkedin-btn') as HTMLButtonElement;
  if (linkedinBtn) linkedinBtn.textContent = tr.openLinkedIn;

  const markSentBtn = document.getElementById('mark-sent-btn') as HTMLButtonElement;
  if (markSentBtn) markSentBtn.textContent = tr.markSent;

  // Export section
  const exportBtn = document.getElementById('export-csv-btn') as HTMLButtonElement;
  if (exportBtn && !exportBtn.disabled) exportBtn.textContent = tr.exportCsv;

  const clearBtn = document.getElementById('clear-candidates-btn') as HTMLButtonElement;
  if (clearBtn && !clearBtn.disabled) clearBtn.textContent = tr.clearCandidates;

  // Overdue section
  const overdueTitle = document.getElementById('overdue-title');
  if (overdueTitle) overdueTitle.textContent = tr.pendingFollowUps;

  // History section
  const historyTitle = document.getElementById('history-title');
  if (historyTitle) historyTitle.textContent = tr.recentCandidates;
}

// ---- Storage rendering ----

async function renderStorageUsage(): Promise<void> {
  const el = document.getElementById('storage-usage');
  if (!el) return;
  const bytes = await getStorageUsageBytes();
  if (bytes === 0) {
    el.textContent = t().storageNotAvailable;
  } else {
    const usedKb = Math.round(bytes / 1024);
    const quotaMb = Math.round(STORAGE_QUOTA_BYTES / (1024 * 1024));
    el.textContent = t().storageUsage(usedKb, quotaMb);
  }
}

async function renderCandidateList(): Promise<void> {
  const listEl = document.getElementById('candidate-list');
  if (!listEl) return;

  const candidates = await getAllCandidates();
  if (candidates.length === 0) {
    listEl.textContent = t().noCandidatesYet;
    return;
  }

  const tierLabels = getTierLabels(currentLang);
  const ul = document.createElement('ul');
  for (const c of candidates) {
    const li = document.createElement('li');
    const dateOnly = c.evaluatedAt.substring(0, 10);
    const label = tierLabels[c.tier] ?? c.tier;
    li.textContent = `${c.name} — ${label} — ${c.score}% — ${dateOnly}`;
    ul.appendChild(li);
  }
  listEl.innerHTML = '';
  listEl.appendChild(ul);
}

async function renderOverdueLow(): Promise<void> {
  const el = document.getElementById('overdue-list');
  if (!el) return;

  const candidates = await getAllCandidates();
  const now = Date.now();
  const overdue = candidates.filter(
    (c) =>
      c.tier === 'low' &&
      c.contactAfter !== undefined &&
      new Date(c.contactAfter).getTime() <= now &&
      !c.messageSentAt,
  );

  if (overdue.length === 0) {
    el.textContent = t().noPendingLow;
    return;
  }

  const ul = document.createElement('ul');
  for (const c of overdue) {
    const li = document.createElement('li');
    const contactAfterDate = c.contactAfter!.substring(0, 10);
    li.textContent = `${c.name} — ${t().contactWindowSince} ${contactAfterDate}`;
    ul.appendChild(li);
  }
  el.innerHTML = '';
  el.appendChild(ul);
}

// ---- Result rendering ----

function showResult(result: EvaluateResult): void {
  lastResult = result;
  const section = document.getElementById('result-section');
  if (!section) return;

  section.hidden = false;

  const errorEl = document.getElementById('result-error')!;
  const tierEl = document.getElementById('result-tier')!;
  const donutEl = document.getElementById('score-donut') as HTMLElement | null;
  const pctLabelEl = document.getElementById('score-pct-label');
  const expLevelEl = document.getElementById('result-experience-level')!;
  const matchedEl = document.getElementById('result-matched-skills')!;
  const missingEl = document.getElementById('result-missing-skills')!;
  const rationaleEl = document.getElementById('result-rationale')!;

  errorEl.textContent = '';
  tierEl.textContent = '';
  if (donutEl) { donutEl.style.removeProperty('--pct'); donutEl.style.removeProperty('--donut-color'); }
  if (pctLabelEl) pctLabelEl.textContent = '';
  expLevelEl.textContent = '';
  matchedEl.innerHTML = '';
  missingEl.innerHTML = '';
  rationaleEl.textContent = '';

  if (result.error) {
    errorEl.textContent = `Error: ${result.error}`;
    return;
  }

  if (result.warning) {
    errorEl.textContent = `${t().warning}: ${result.warning}`;
  }

  // Re-compute tier label in current language
  const tierLabels = getTierLabels(currentLang);
  tierEl.textContent = tierLabels[result.tier] ?? result.tierLabel;
  tierEl.dataset.tier = result.tier;

  // Donut chart — color keyed to tier
  const tierDonutColors: Record<string, string> = {
    high: '#C8522A',
    medium: '#D97020',
    low: '#E89840',
    rejected: '#dc2626',
  };
  const donutColor = tierDonutColors[result.tier] ?? '#C8522A';
  if (donutEl) {
    donutEl.style.setProperty('--pct', `${result.score}%`);
    donutEl.style.setProperty('--donut-color', donutColor);
  }
  if (pctLabelEl) pctLabelEl.textContent = `${result.score}%`;

  if (result.experienceLevel) {
    const levelYears: Record<string, string> = {
      junior: t().juniorYears,
      mid: t().midYears,
      senior: t().seniorYears,
      staff: t().staffYears,
    };
    expLevelEl.textContent = `${t().level}: ${levelYears[result.experienceLevel] ?? result.experienceLevel}`;
    expLevelEl.dataset.level = result.experienceLevel;
  }

  const matchedLabel = document.createElement('strong');
  matchedLabel.textContent = `${t().matchedSkillsLabel}: `;
  matchedEl.appendChild(matchedLabel);
  matchedEl.appendChild(
    document.createTextNode(
      result.matchedSkills.length > 0 ? result.matchedSkills.join(', ') : t().none
    )
  );

  const missingLabel = document.createElement('strong');
  missingLabel.textContent = `${t().missingSkillsLabel}: `;
  missingEl.appendChild(missingLabel);
  missingEl.appendChild(
    document.createTextNode(
      result.missingSkills.length > 0 ? result.missingSkills.join(', ') : t().none
    )
  );

  rationaleEl.textContent = result.rationale;

  // Red flags section
  const redFlagsSection = document.getElementById('red-flags-section') as HTMLElement;
  const redFlagsList = document.getElementById('red-flags-list')!;
  redFlagsList.innerHTML = '';

  if (result.redFlags && result.redFlags.length > 0) {
    redFlagsSection.hidden = false;
    result.redFlags.forEach((rf) => {
      const card = document.createElement('div');
      card.className = 'red-flag-card';

      const flagEl = document.createElement('p');
      flagEl.className = 'red-flag-text';
      flagEl.textContent = rf.flag;

      const qLabel = document.createElement('p');
      qLabel.className = 'red-flag-question';
      qLabel.innerHTML = `<strong>${t().question}:</strong> ` + rf.question;

      const aLabel = document.createElement('p');
      aLabel.className = 'red-flag-answer';
      aLabel.innerHTML = `<strong>${t().expectedAnswer}:</strong> ` + rf.expectedAnswer;

      card.appendChild(flagEl);
      card.appendChild(qLabel);
      card.appendChild(aLabel);
      redFlagsList.appendChild(card);
    });
  } else {
    redFlagsSection.hidden = true;
  }

  currentCandidateId = result.candidateId;

  const generateBtn = document.getElementById('generate-msg-btn') as HTMLButtonElement;
  const msgSection = document.getElementById('message-section');
  if (msgSection && result.tier !== 'rejected' && result.candidateId) {
    msgSection.hidden = false;
    generateBtn.disabled = false;
    generateBtn.textContent = t().draftMessage;
    const textarea = document.getElementById('message-textarea') as HTMLTextAreaElement;
    textarea.value = '';
    setMessageButtonsEnabled(false);
    document.getElementById('message-status')!.textContent = '';
  } else if (msgSection) {
    msgSection.hidden = true;
    generateBtn.disabled = true;
  }
}

function setMessageButtonsEnabled(enabled: boolean): void {
  (document.getElementById('copy-msg-btn') as HTMLButtonElement).disabled = !enabled;
  (document.getElementById('open-linkedin-btn') as HTMLButtonElement).disabled = !enabled;
  (document.getElementById('mark-sent-btn') as HTMLButtonElement).disabled = !enabled;
}

// ---- Language toggle ----

async function switchLanguage(): Promise<void> {
  currentLang = currentLang === 'es' ? 'en' : 'es';
  await setLang(currentLang);

  applyStaticTranslations();
  await renderStorageUsage();
  await renderCandidateList();
  await renderOverdueLow();

  if (!lastResult || lastResult.error) return;

  // Toggling back to the original evaluation language — restore original, no API call needed
  if (currentLang === originalResultLang && originalResult) {
    lastResult = originalResult;
    translatedResultCache = null; // invalidate cache so next toggle re-translates fresh
    showResult(lastResult);
    return;
  }

  // Toggling to the non-original language — use cached translation if valid
  if (translatedResultCache) {
    lastResult = translatedResultCache;
    showResult(lastResult);
    return;
  }

  // Show immediately with updated labels while translation is in progress
  showResult(lastResult);

  const hasContent = originalResult?.rationale || (originalResult?.redFlags && originalResult.redFlags.length > 0);
  if (!hasContent || !originalResult) return;

  try {
    const translated = await browser.runtime.sendMessage({
      type: 'TRANSLATE_RESULT',
      rationale: originalResult.rationale ?? '',
      redFlags: originalResult.redFlags ?? [],
      targetLang: currentLang,
    }) as TranslateResultResult | undefined;

    if (translated && !translated.translationFailed && !translated.error) {
      const newResult = { ...originalResult, rationale: translated.rationale, redFlags: translated.redFlags };
      translatedResultCache = newResult;
      lastResult = newResult;
      showResult(lastResult);
    }
    // On failure: content stays in original language; no cache set so user can retry by toggling
  } catch {
    // Message channel error — content stays in original language, not a blocker
  }
}

// ---- Event listeners ----

const langToggleEl = document.getElementById('lang-toggle-btn');
langToggleEl?.addEventListener('click', () => { void switchLanguage(); });
langToggleEl?.addEventListener('keydown', (e) => {
  if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') {
    e.preventDefault();
    void switchLanguage();
  }
});

document.getElementById('settings-link')?.addEventListener('click', (e) => {
  e.preventDefault();
  browser.runtime.openOptionsPage();
});

document.getElementById('evaluate-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('evaluate-btn') as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = t().evaluating;

  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    currentProfileUrl = tab?.url ?? null;

    const result = await browser.runtime.sendMessage({ type: 'EVALUATE' }) as EvaluateResult | undefined;
    // New evaluation — reset original and clear translation cache
    translatedResultCache = null;
    if (result === undefined) {
      originalResult = null;
      showResult({
        score: 0,
        tier: 'rejected',
        tierLabel: getTierLabels(currentLang)['rejected'],
        matchedSkills: [],
        missingSkills: [],
        rationale: '',
        candidateId: '',
        error: t().bgNotReady,
      });
    } else {
      originalResult = result;
      originalResultLang = result.evaluationLang ?? currentLang;
      showResult(result);
      await renderCandidateList();
    }
  } catch (err) {
    const section = document.getElementById('result-section');
    if (section) section.hidden = false;
    const errorEl = document.getElementById('result-error');
    if (errorEl) {
      errorEl.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  } finally {
    btn.disabled = false;
    btn.textContent = t().evaluate;
  }
});

document.getElementById('generate-msg-btn')?.addEventListener('click', async () => {
  if (!currentCandidateId) return;

  const btn = document.getElementById('generate-msg-btn') as HTMLButtonElement;
  const statusEl = document.getElementById('message-status')!;
  btn.disabled = true;
  btn.textContent = t().generating;
  statusEl.textContent = '';

  try {
    const result = await browser.runtime.sendMessage({
      type: 'GENERATE_MESSAGE',
      candidateId: currentCandidateId,
    }) as GenerateMessageResult | undefined;

    if (result?.message) {
      (document.getElementById('message-textarea') as HTMLTextAreaElement).value = result.message;
      setMessageButtonsEnabled(true);
    } else {
      statusEl.textContent = result?.error ?? t().couldNotGenerate;
      statusEl.className = 'error-message';
    }
  } catch (err) {
    statusEl.textContent = err instanceof Error ? err.message : String(err);
    statusEl.className = 'error-message';
  } finally {
    btn.disabled = false;
    btn.textContent = t().draftMessage;
  }
});

document.getElementById('copy-msg-btn')?.addEventListener('click', async () => {
  const textarea = document.getElementById('message-textarea') as HTMLTextAreaElement;
  const statusEl = document.getElementById('message-status')!;
  try {
    await navigator.clipboard.writeText(textarea.value);
    statusEl.textContent = t().copied;
    statusEl.className = 'success-message';
    setTimeout(() => { statusEl.textContent = ''; }, 2000);
  } catch {
    statusEl.textContent = t().couldNotCopy;
    statusEl.className = 'error-message';
  }
});

document.getElementById('open-linkedin-btn')?.addEventListener('click', async () => {
  if (!currentProfileUrl) return;
  const profilePath = new URL(currentProfileUrl).pathname;
  const msgUrl = `https://www.linkedin.com/messaging/compose/?recipient=${encodeURIComponent(profilePath)}`;
  await browser.tabs.create({ url: msgUrl });
});

document.getElementById('mark-sent-btn')?.addEventListener('click', async () => {
  if (!currentCandidateId) return;
  const textarea = document.getElementById('message-textarea') as HTMLTextAreaElement;
  const statusEl = document.getElementById('message-status')!;

  const result = await browser.runtime.sendMessage({
    type: 'SAVE_MESSAGE',
    candidateId: currentCandidateId,
    messageText: textarea.value,
  }) as SaveMessageResult | undefined;

  if (result?.saved) {
    statusEl.textContent = t().messageSent;
    statusEl.className = 'success-message';
    await renderCandidateList();
  } else {
    statusEl.textContent = result?.error ?? t().couldNotSave;
    statusEl.className = 'error-message';
  }
});

document.getElementById('clear-candidates-btn')?.addEventListener('click', async () => {
  const confirmed = window.confirm(t().clearConfirm);
  if (!confirmed) return;

  const btn = document.getElementById('clear-candidates-btn') as HTMLButtonElement;
  btn.disabled = true;
  try {
    await clearAllCandidates();
    await renderCandidateList();
    await renderOverdueLow();
    await renderStorageUsage();
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('export-csv-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('export-csv-btn') as HTMLButtonElement;
  btn.disabled = true;
  try {
    const candidates = await getAllCandidates();
    if (candidates.length === 0) {
      btn.textContent = t().noCandidatesExport;
      setTimeout(() => { btn.textContent = t().exportCsv; btn.disabled = false; }, 2000);
      return;
    }
    const csv = candidatesToCsv(candidates, currentLang);
    const date = new Date().toISOString().substring(0, 10);
    downloadCsv(csv, `hhrh-candidates-${date}.csv`);
  } finally {
    btn.disabled = false;
  }
});

// ---- Init ----

async function restoreResultForCurrentTab(): Promise<void> {
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url;
    if (!url || !url.includes('linkedin.com/in/')) return;

    const activeJdId = await getActiveJdId();
    const candidates = await getAllCandidates();

    // Find the most recent evaluation for this URL, preferring the active JD
    const match =
      candidates.find((c) => c.profileUrl === url && c.jdId === activeJdId) ??
      candidates.find((c) => c.profileUrl === url);

    if (!match) return;

    const tierLabels = getTierLabels(currentLang);
    const restored: import('../../src/shared/messages').EvaluateResult = {
      score: match.score,
      tier: match.tier,
      tierLabel: tierLabels[match.tier],
      matchedSkills: match.matchedSkills,
      missingSkills: match.missingSkills,
      rationale: match.rationale ?? '',
      experienceLevel: match.experienceLevel,
      redFlags: match.redFlags ?? [],
      candidateId: match.id,
      evaluationLang: match.evaluationLang ?? 'es',
    };

    originalResult = restored;
    originalResultLang = restored.evaluationLang!;
    translatedResultCache = null;
    currentProfileUrl = match.profileUrl;

    // If the popup language differs from the evaluation language, show in eval language for now
    // (user can toggle to translate — avoids an API call on every popup open)
    lastResult = restored;
    showResult(restored);
  } catch {
    // Non-critical — popup still works without restored result
  }
}

async function init(): Promise<void> {
  currentLang = await getLang();
  applyStaticTranslations();
  await renderStorageUsage();
  await renderCandidateList();
  await renderOverdueLow();
  await restoreResultForCurrentTab();
}

void init();
