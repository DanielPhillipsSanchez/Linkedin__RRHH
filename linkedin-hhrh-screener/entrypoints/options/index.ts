// entrypoints/options/index.ts
// Options page controller — API key save/validate + JD CRUD

import { saveJd, getAllJds, deleteJd } from '../../src/storage/storage';
import type { JobDescription } from '../../src/storage/schema';

// ---- API Key ----

async function updateApiKeyIndicator(): Promise<void> {
  const indicator = document.getElementById('api-key-indicator') as HTMLParagraphElement;
  const result = await browser.storage.local.get('settings:apiKey');
  const hasKey = !!result['settings:apiKey'];
  indicator.textContent = hasKey ? 'A key is saved' : 'No key saved';
}

async function handleApiKeySave(): Promise<void> {
  const input = document.getElementById('api-key-input') as HTMLInputElement;
  const status = document.getElementById('api-key-status') as HTMLElement;
  const key = input.value.trim();
  if (!key) return;

  // Optional pre-check: warn if format looks wrong, but still proceed
  if (!/^sk-ant-/.test(key)) {
    status.textContent = 'Warning: key does not start with sk-ant- — proceeding anyway';
  } else {
    status.textContent = '';
  }

  await browser.storage.local.set({ 'settings:apiKey': key });
  status.textContent = 'Validating...';

  const result = await browser.runtime.sendMessage({ type: 'VALIDATE_API_KEY' }) as { valid: boolean; error?: string };

  if (result.valid) {
    status.textContent = 'API key saved and validated';
    input.value = ''; // Clear — never display stored key
    await updateApiKeyIndicator();
  } else {
    status.textContent = `Validation failed: ${result.error ?? 'Unknown error'}`;
    // Key is saved but failed validation — recruiter can retry or replace
  }
}

// ---- Job Descriptions ----

async function renderJdList(): Promise<void> {
  const list = document.getElementById('jd-list') as HTMLUListElement;
  const jds = await getAllJds();
  list.innerHTML = '';

  if (jds.length === 0) {
    list.innerHTML = '<li><em>No job descriptions saved yet.</em></li>';
    return;
  }

  jds.forEach(jd => {
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>${jd.title}</strong>
      <span style="color:#666; font-size:0.85em;">(${jd.skills.length} skills)</span>
      <button data-delete-jd="${jd.id}">Delete</button>
    `;
    list.appendChild(li);
  });
}

async function handleJdAdd(): Promise<void> {
  const titleInput = document.getElementById('jd-title-input') as HTMLInputElement;
  const rawTextInput = document.getElementById('jd-raw-text-input') as HTMLTextAreaElement;
  const title = titleInput.value.trim();
  const rawText = rawTextInput.value.trim();
  if (!title || !rawText) return;

  const jd: JobDescription = {
    id: crypto.randomUUID(),
    title,
    rawText,
    skills: [], // Skills tagged in Plan 05
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveJd(jd);
  titleInput.value = '';
  rawTextInput.value = '';
  await renderJdList();
}

// ---- Initialise ----

document.addEventListener('DOMContentLoaded', async () => {
  // Render initial state
  await updateApiKeyIndicator();
  await renderJdList();

  // API key save
  const saveBtn = document.getElementById('api-key-save-btn') as HTMLButtonElement;
  saveBtn.addEventListener('click', () => void handleApiKeySave());

  // JD add
  const addBtn = document.getElementById('jd-add-btn') as HTMLButtonElement;
  addBtn.addEventListener('click', () => void handleJdAdd());

  // JD delete — event delegation on the list
  const jdList = document.getElementById('jd-list') as HTMLUListElement;
  jdList.addEventListener('click', async (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const jdId = target.dataset.deleteJd;
    if (jdId) {
      await deleteJd(jdId);
      await renderJdList();
    }
  });
});
