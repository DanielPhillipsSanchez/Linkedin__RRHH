import { getStorageUsageBytes, STORAGE_QUOTA_BYTES, getAllCandidates, clearAllCandidates } from '../../src/storage/storage';
import type { EvaluateResult, GenerateMessageResult, SaveMessageResult } from '../../src/shared/messages';
import { TIER_LABELS } from '../../src/scorer/tiers';
import { candidatesToCsv, downloadCsv } from '../../src/shared/csv';

let currentCandidateId: string | null = null;
let currentProfileUrl: string | null = null;

document.getElementById('settings-link')?.addEventListener('click', (e) => {
  e.preventDefault();
  browser.runtime.openOptionsPage();
});

async function renderStorageUsage(): Promise<void> {
  const el = document.getElementById('storage-usage');
  if (!el) return;
  const bytes = await getStorageUsageBytes();
  if (bytes === 0) {
    el.textContent = 'Storage: unavailable';
  } else {
    const usedKb = Math.round(bytes / 1024);
    const quotaMb = Math.round(STORAGE_QUOTA_BYTES / (1024 * 1024));
    el.textContent = `Storage: ${usedKb} KB / ${quotaMb} MB`;
  }
}

async function renderCandidateList(): Promise<void> {
  const listEl = document.getElementById('candidate-list');
  if (!listEl) return;

  const candidates = await getAllCandidates();
  if (candidates.length === 0) {
    listEl.textContent = 'No candidates yet';
    return;
  }

  const ul = document.createElement('ul');
  for (const c of candidates) {
    const li = document.createElement('li');
    const dateOnly = c.evaluatedAt.substring(0, 10);
    const label = TIER_LABELS[c.tier] ?? c.tier;
    li.textContent = `${c.name} — ${label} — ${c.score}% — ${dateOnly}`;
    ul.appendChild(li);
  }
  listEl.innerHTML = '';
  listEl.appendChild(ul);
}

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

function showResult(result: EvaluateResult): void {
  const section = document.getElementById('result-section');
  if (!section) return;

  section.hidden = false;

  const errorEl = document.getElementById('result-error')!;
  const tierEl = document.getElementById('result-tier')!;
  const scoreEl = document.getElementById('result-score')!;
  const matchedEl = document.getElementById('result-matched-skills')!;
  const missingEl = document.getElementById('result-missing-skills')!;
  const rationaleEl = document.getElementById('result-rationale')!;

  errorEl.textContent = '';
  tierEl.textContent = '';
  scoreEl.textContent = '';
  matchedEl.innerHTML = '';
  missingEl.innerHTML = '';
  rationaleEl.textContent = '';

  if (result.error) {
    errorEl.textContent = `Error: ${result.error}`;
    return;
  }

  if (result.warning) {
    errorEl.textContent = `Warning: ${result.warning}`;
  }

  tierEl.textContent = result.tierLabel;
  tierEl.dataset.tier = result.tier;

  scoreEl.textContent = `Match: ${result.score}%`;

  const matchedLabel = document.createElement('strong');
  matchedLabel.textContent = 'Matched skills: ';
  matchedEl.appendChild(matchedLabel);
  matchedEl.appendChild(
    document.createTextNode(
      result.matchedSkills.length > 0 ? result.matchedSkills.join(', ') : 'None'
    )
  );

  const missingLabel = document.createElement('strong');
  missingLabel.textContent = 'Missing skills: ';
  missingEl.appendChild(missingLabel);
  missingEl.appendChild(
    document.createTextNode(
      result.missingSkills.length > 0 ? result.missingSkills.join(', ') : 'None'
    )
  );

  rationaleEl.textContent = result.rationale;

  currentCandidateId = result.candidateId;

  const generateBtn = document.getElementById('generate-msg-btn') as HTMLButtonElement;
  const msgSection = document.getElementById('message-section');
  if (msgSection && result.tier !== 'rejected' && result.candidateId) {
    msgSection.hidden = false;
    generateBtn.disabled = false;
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

document.getElementById('evaluate-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('evaluate-btn') as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = 'Evaluating...';

  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    currentProfileUrl = tab?.url ?? null;

    const result = await browser.runtime.sendMessage({ type: 'EVALUATE' }) as EvaluateResult | undefined;
    if (result === undefined) {
      showResult({
        score: 0,
        tier: 'rejected',
        tierLabel: TIER_LABELS['rejected'],
        matchedSkills: [],
        missingSkills: [],
        rationale: '',
        candidateId: '',
        error: 'Background service worker not ready — please reload the extension and try again',
      });
    } else {
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
    btn.textContent = 'Evaluate';
  }
});

document.getElementById('generate-msg-btn')?.addEventListener('click', async () => {
  if (!currentCandidateId) return;

  const btn = document.getElementById('generate-msg-btn') as HTMLButtonElement;
  const statusEl = document.getElementById('message-status')!;
  btn.disabled = true;
  btn.textContent = 'Generating...';
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
      statusEl.textContent = result?.error ?? 'Failed to generate message';
      statusEl.className = 'error-message';
    }
  } catch (err) {
    statusEl.textContent = err instanceof Error ? err.message : String(err);
    statusEl.className = 'error-message';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate Message';
  }
});

document.getElementById('copy-msg-btn')?.addEventListener('click', async () => {
  const textarea = document.getElementById('message-textarea') as HTMLTextAreaElement;
  const statusEl = document.getElementById('message-status')!;
  try {
    await navigator.clipboard.writeText(textarea.value);
    statusEl.textContent = 'Copied!';
    statusEl.className = 'success-message';
    setTimeout(() => { statusEl.textContent = ''; }, 2000);
  } catch {
    statusEl.textContent = 'Copy failed — please select and copy manually';
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
    statusEl.textContent = 'Message marked as sent';
    statusEl.className = 'success-message';
    await renderCandidateList();
  } else {
    statusEl.textContent = result?.error ?? 'Failed to save';
    statusEl.className = 'error-message';
  }
});

document.getElementById('clear-candidates-btn')?.addEventListener('click', async () => {
  const confirmed = window.confirm('¿Borrar todos los candidatos? Esta acción no se puede deshacer.');
  if (!confirmed) return;

  const btn = document.getElementById('clear-candidates-btn') as HTMLButtonElement;
  btn.disabled = true;
  try {
    await clearAllCandidates();
    await renderCandidateList();
    await renderOverdueL3();
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
      btn.textContent = 'No candidates to export';
      setTimeout(() => { btn.textContent = 'Export CSV'; btn.disabled = false; }, 2000);
      return;
    }
    const csv = candidatesToCsv(candidates);
    const date = new Date().toISOString().substring(0, 10);
    downloadCsv(csv, `hhrh-candidates-${date}.csv`);
  } finally {
    btn.disabled = false;
  }
});

renderStorageUsage();
renderCandidateList();
renderOverdueL3();
