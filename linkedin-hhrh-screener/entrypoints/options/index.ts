// entrypoints/options/index.ts
// Options page controller — API key save/validate + JD CRUD + skill editor + active JD

import { saveJd, getAllJds, deleteJd, setActiveJdId, getActiveJdId } from '../../src/storage/storage';
import type { JobDescription, Skill } from '../../src/storage/schema';

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

function buildSkillEditorHtml(jd: JobDescription): string {
  const skillRows = jd.skills.map((skill, i) => `
    <div class="skill-row" data-skill-index="${i}">
      <span class="skill-text">${skill.text}</span>
      <label style="display:inline; font-weight:normal;">
        <input type="radio" name="skill-${jd.id}-${i}-weight" value="mandatory"
          ${skill.weight === 'mandatory' ? 'checked' : ''} data-weight-jd="${jd.id}" data-weight-index="${i}">
        Mandatory
      </label>
      <label style="display:inline; font-weight:normal;">
        <input type="radio" name="skill-${jd.id}-${i}-weight" value="nice-to-have"
          ${skill.weight === 'nice-to-have' ? 'checked' : ''} data-weight-jd="${jd.id}" data-weight-index="${i}">
        Nice-to-have
      </label>
      <button data-remove-skill="${i}" data-jd-id="${jd.id}">×</button>
    </div>
  `).join('');

  return `
    <details>
      <summary>Edit Skills (${jd.skills.length})</summary>
      <div class="skill-list-editor" data-jd-id="${jd.id}">
        ${skillRows || '<p style="color:#888; font-size:0.85em;">No skills added yet.</p>'}
        <div class="add-skill-form">
          <input type="text" class="skill-text-input" placeholder="e.g. TypeScript">
          <select class="skill-weight-select">
            <option value="mandatory">Mandatory</option>
            <option value="nice-to-have">Nice-to-have</option>
          </select>
          <button class="add-skill-btn" data-jd-id="${jd.id}">Add Skill</button>
        </div>
      </div>
    </details>
  `;
}

async function renderJdList(): Promise<void> {
  const list = document.getElementById('jd-list') as HTMLUListElement;
  const jds = await getAllJds();
  list.innerHTML = '';

  if (jds.length === 0) {
    list.innerHTML = '<li><em>No job descriptions saved yet.</em></li>';
    await renderActiveJdSelector();
    return;
  }

  jds.forEach(jd => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="jd-item-header">
        <strong>${jd.title}</strong>
        <span style="color:#666; font-size:0.85em;">(${jd.skills.length} skills)</span>
        <button data-delete-jd="${jd.id}">Delete</button>
      </div>
      ${buildSkillEditorHtml(jd)}
    `;
    list.appendChild(li);
  });

  await renderActiveJdSelector();
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
    skills: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveJd(jd);
  titleInput.value = '';
  rawTextInput.value = '';
  await renderJdList();
}

// ---- Active JD Selector ----

async function renderActiveJdSelector(): Promise<void> {
  const container = document.getElementById('active-jd-selector') as HTMLElement;
  if (!container) return;
  const jds = await getAllJds();
  const activeId = await getActiveJdId();

  if (jds.length === 0) {
    container.innerHTML = '<p><em>Add at least one job description above.</em></p>';
    return;
  }

  container.innerHTML = '';
  jds.forEach(jd => {
    const label = document.createElement('label');
    label.style.display = 'block';
    label.style.fontWeight = 'normal';
    label.innerHTML = `
      <input type="radio" name="active-jd" value="${jd.id}"
        ${activeId === jd.id ? 'checked' : ''}>
      ${jd.title}
    `;
    container.appendChild(label);
  });
}

// ---- Initialise ----

document.addEventListener('DOMContentLoaded', async () => {
  // Render initial state
  await updateApiKeyIndicator();
  await renderJdList(); // also calls renderActiveJdSelector

  // API key save
  const saveBtn = document.getElementById('api-key-save-btn') as HTMLButtonElement;
  saveBtn.addEventListener('click', () => void handleApiKeySave());

  // JD add
  const addBtn = document.getElementById('jd-add-btn') as HTMLButtonElement;
  addBtn.addEventListener('click', () => void handleJdAdd());

  // JD list: delete, skill add, skill remove, weight change — all via event delegation
  const jdList = document.getElementById('jd-list') as HTMLUListElement;

  jdList.addEventListener('click', async (event: MouseEvent) => {
    const target = event.target as HTMLElement;

    // Delete JD
    const deleteJdId = target.dataset.deleteJd;
    if (deleteJdId) {
      await deleteJd(deleteJdId);
      await renderJdList();
      return;
    }

    // Add skill
    if (target.classList.contains('add-skill-btn')) {
      const jdId = target.dataset.jdId!;
      const form = target.closest('.add-skill-form') as HTMLElement;
      const textInput = form.querySelector('.skill-text-input') as HTMLInputElement;
      const weightSelect = form.querySelector('.skill-weight-select') as HTMLSelectElement;
      const text = textInput.value.trim();
      if (!text) return;
      const allJds = await getAllJds();
      const jd = allJds.find(j => j.id === jdId);
      if (!jd) return;
      const newSkill: Skill = { text, weight: weightSelect.value as Skill['weight'] };
      await saveJd({ ...jd, skills: [...jd.skills, newSkill], updatedAt: new Date().toISOString() });
      await renderJdList();
      return;
    }

    // Remove skill
    const removeSkillIndex = target.dataset.removeSkill;
    if (removeSkillIndex !== undefined) {
      const jdId = target.dataset.jdId!;
      const allJds = await getAllJds();
      const jd = allJds.find(j => j.id === jdId);
      if (!jd) return;
      const updatedSkills = jd.skills.filter((_, i) => i !== parseInt(removeSkillIndex, 10));
      await saveJd({ ...jd, skills: updatedSkills, updatedAt: new Date().toISOString() });
      await renderJdList();
      return;
    }
  });

  // Weight change via event delegation on change event
  jdList.addEventListener('change', async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const jdId = target.dataset.weightJd;
    const skillIndex = target.dataset.weightIndex;
    if (!jdId || skillIndex === undefined) return;
    const allJds = await getAllJds();
    const jd = allJds.find(j => j.id === jdId);
    if (!jd) return;
    const updatedSkills = jd.skills.map((skill, i) =>
      i === parseInt(skillIndex, 10) ? { ...skill, weight: target.value as Skill['weight'] } : skill
    );
    await saveJd({ ...jd, skills: updatedSkills, updatedAt: new Date().toISOString() });
    // No re-render needed — radio state is already correct in DOM
  });

  // Active JD selection
  const activeJdSelector = document.getElementById('active-jd-selector') as HTMLElement;
  activeJdSelector?.addEventListener('change', async (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.name === 'active-jd') {
      await setActiveJdId(target.value);
    }
  });
});
