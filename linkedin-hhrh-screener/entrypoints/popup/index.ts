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
    el.textContent = 'Almacenamiento: no disponible';
  } else {
    const usedKb = Math.round(bytes / 1024);
    const quotaMb = Math.round(STORAGE_QUOTA_BYTES / (1024 * 1024));
    el.textContent = `Almacenamiento: ${usedKb} KB / ${quotaMb} MB`;
  }
}

async function renderCandidateList(): Promise<void> {
  const listEl = document.getElementById('candidate-list');
  if (!listEl) return;

  const candidates = await getAllCandidates();
  if (candidates.length === 0) {
    listEl.textContent = 'Aún no hay candidatos';
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
    el.textContent = 'Sin candidatos L3 pendientes de contacto';
    return;
  }

  const ul = document.createElement('ul');
  for (const c of overdue) {
    const li = document.createElement('li');
    const contactAfterDate = c.contactAfter!.substring(0, 10);
    li.textContent = `${c.name} — ventana de contacto abierta desde ${contactAfterDate}`;
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
  const expLevelEl = document.getElementById('result-experience-level')!;
  const matchedEl = document.getElementById('result-matched-skills')!;
  const missingEl = document.getElementById('result-missing-skills')!;
  const rationaleEl = document.getElementById('result-rationale')!;

  errorEl.textContent = '';
  tierEl.textContent = '';
  scoreEl.textContent = '';
  expLevelEl.textContent = '';
  matchedEl.innerHTML = '';
  missingEl.innerHTML = '';
  rationaleEl.textContent = '';

  if (result.error) {
    errorEl.textContent = `Error: ${result.error}`; // keep "Error:" prefix as-is (universal term)
    return;
  }

  if (result.warning) {
    errorEl.textContent = `Aviso: ${result.warning}`;
  }

  tierEl.textContent = result.tierLabel;
  tierEl.dataset.tier = result.tier;

  scoreEl.textContent = `Encaje: ${result.score}%`;

  if (result.experienceLevel) {
    const LEVEL_LABELS: Record<string, string> = {
      junior: 'Junior (<3 años)',
      mid: 'Mid (3–6 años)',
      senior: 'Senior (6–12 años)',
      staff: 'Staff / Principal (12+ años)',
    };
    expLevelEl.textContent = `Nivel: ${LEVEL_LABELS[result.experienceLevel] ?? result.experienceLevel}`;
    expLevelEl.dataset.level = result.experienceLevel;
  }

  const matchedLabel = document.createElement('strong');
  matchedLabel.textContent = 'Habilidades que encajan: ';
  matchedEl.appendChild(matchedLabel);
  matchedEl.appendChild(
    document.createTextNode(
      result.matchedSkills.length > 0 ? result.matchedSkills.join(', ') : 'Ninguna'
    )
  );

  const missingLabel = document.createElement('strong');
  missingLabel.textContent = 'Habilidades que faltan: ';
  missingEl.appendChild(missingLabel);
  missingEl.appendChild(
    document.createTextNode(
      result.missingSkills.length > 0 ? result.missingSkills.join(', ') : 'Ninguna'
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
      qLabel.innerHTML = '<strong>Pregunta:</strong> ' + rf.question;

      const aLabel = document.createElement('p');
      aLabel.className = 'red-flag-answer';
      aLabel.innerHTML = '<strong>Respuesta esperada:</strong> ' + rf.expectedAnswer;

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
  btn.textContent = 'Evaluando...';

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
        error: 'El servicio en segundo plano no está listo — recarga la extensión y vuelve a intentarlo',
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
    btn.textContent = 'Evaluar';
  }
});

document.getElementById('generate-msg-btn')?.addEventListener('click', async () => {
  if (!currentCandidateId) return;

  const btn = document.getElementById('generate-msg-btn') as HTMLButtonElement;
  const statusEl = document.getElementById('message-status')!;
  btn.disabled = true;
  btn.textContent = 'Generando...';
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
      statusEl.textContent = result?.error ?? 'No se pudo generar el mensaje';
      statusEl.className = 'error-message';
    }
  } catch (err) {
    statusEl.textContent = err instanceof Error ? err.message : String(err);
    statusEl.className = 'error-message';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Redactar mensaje';
  }
});

document.getElementById('copy-msg-btn')?.addEventListener('click', async () => {
  const textarea = document.getElementById('message-textarea') as HTMLTextAreaElement;
  const statusEl = document.getElementById('message-status')!;
  try {
    await navigator.clipboard.writeText(textarea.value);
    statusEl.textContent = '¡Copiado!';
    statusEl.className = 'success-message';
    setTimeout(() => { statusEl.textContent = ''; }, 2000);
  } catch {
    statusEl.textContent = 'No se pudo copiar — selecciona el texto y cópialo manualmente';
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
    statusEl.textContent = 'Mensaje marcado como enviado';
    statusEl.className = 'success-message';
    await renderCandidateList();
  } else {
    statusEl.textContent = result?.error ?? 'No se pudo guardar';
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
      btn.textContent = 'Sin candidatos para exportar';
      setTimeout(() => { btn.textContent = 'Exportar CSV'; btn.disabled = false; }, 2000);
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
