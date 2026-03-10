import { getStorageUsageBytes, STORAGE_QUOTA_BYTES, getAllCandidates } from '../../src/storage/storage';
import type { EvaluateResult } from '../../src/shared/messages';
import { TIER_LABELS } from '../../src/scorer/tiers';

// ---- Settings link ----

document.getElementById('settings-link')?.addEventListener('click', (e) => {
  e.preventDefault();
  browser.runtime.openOptionsPage();
});

// ---- Storage usage ----

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

// ---- Candidate history ----

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

// ---- Result display ----

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

  // Clear previous state
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

  // Non-fatal warning (e.g. Claude API key invalid — score is keyword-only)
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
}

// ---- Evaluate button ----

document.getElementById('evaluate-btn')?.addEventListener('click', async () => {
  const btn = document.getElementById('evaluate-btn') as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = 'Evaluating...';

  try {
    const result = await browser.runtime.sendMessage({ type: 'EVALUATE' }) as EvaluateResult | undefined;
    if (result === undefined) {
      // Chrome MV3: background service worker may not have been running — show actionable error
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
      // Refresh candidate history after evaluation
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

// ---- Init ----

renderStorageUsage();
renderCandidateList();
