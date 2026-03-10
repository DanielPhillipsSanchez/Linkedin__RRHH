// entrypoints/options/index.ts
// Options page controller — Anthropic API key + JD CRUD + skill editor + active JD

import { saveJd, getAllJds, deleteJd, setActiveJdId, getActiveJdId, saveAnthropicApiKey, getAnthropicApiKey, isApiKeyBuiltIn } from '../../src/storage/storage';
import type { JobDescription, Skill } from '../../src/storage/schema';
import * as XLSX from 'xlsx';

// ---- Anthropic API Key ----

async function updateClaudeApiKeyIndicator(): Promise<void> {
  const indicator = document.getElementById('claude-api-key-indicator') as HTMLParagraphElement;
  const key = await getAnthropicApiKey();
  indicator.textContent = key ? 'Anthropic API key saved' : 'No Anthropic API key saved';
}

async function handleApiKeySave(): Promise<void> {
  const input = document.getElementById('claude-api-key-input') as HTMLInputElement;
  const status = document.getElementById('claude-api-key-status') as HTMLElement;
  const key = input.value.trim();

  if (!key) {
    status.textContent = 'Please enter an API key';
    return;
  }

  await saveAnthropicApiKey(key);
  status.textContent = 'Validating...';

  const result = await browser.runtime.sendMessage({ type: 'VALIDATE_API_KEY' }) as { valid: boolean; error?: string };

  if (result.valid) {
    status.textContent = 'Anthropic API key validated';
    input.value = '';
    await updateClaudeApiKeyIndicator();
  } else {
    status.textContent = `Validation failed: ${result.error ?? 'Unknown error'}`;
  }
}

async function handleApiKeyClear(): Promise<void> {
  const status = document.getElementById('claude-api-key-status') as HTMLElement;
  await saveAnthropicApiKey('');
  status.textContent = 'Anthropic API key cleared';
  await updateClaudeApiKeyIndicator();
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

// ---- Excel JD Import ----

// Maps any column name variant → canonical field key
const COL_ALIASES: Record<string, string> = {
  // Title
  position_title: 'title', 'job title': 'title', título: 'title', titulo: 'title', title: 'title', puesto: 'title',
  // Seniority (combined into title)
  seniority: 'seniority', senioridad: 'seniority',
  // Description
  job_description_es: 'description', job_description: 'description', descripción: 'description',
  descripcion: 'description', description: 'description', oferta: 'description',
  // Primary skills → mandatory
  primary_skills: 'primary_skills', habilidades_primarias: 'primary_skills',
  habilidades: 'primary_skills', skills: 'primary_skills', competencias: 'primary_skills',
  // Preferred skills → nice-to-have
  preferred_skills: 'preferred_skills', habilidades_preferidas: 'preferred_skills',
  // Tools → nice-to-have
  tools: 'tools', herramientas: 'tools',
  // Languages
  required_languages: 'languages', idiomas: 'languages', languages: 'languages',
  // Experience years (informational only, added to rawText)
  years_experience_min: 'experience', experiencia: 'experience', experience: 'experience',
};

function normalizeColName(name: string): string {
  // Strip BOM character that Excel sometimes adds to first column
  return COL_ALIASES[name.trim().toLowerCase().replace(/^\uFEFF/, '')] ?? 'other';
}

function splitSkills(raw: string, weight: Skill['weight']): Skill[] {
  return raw
    .split(/[,;\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .map(text => ({ text, weight }));
}

async function handleExcelImport(file: File): Promise<void> {
  const statusEl = document.getElementById('jd-excel-status') as HTMLElement;
  statusEl.textContent = 'Procesando...';

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });

    if (rows.length === 0) {
      statusEl.textContent = 'El archivo está vacío o no tiene el formato esperado.';
      return;
    }

    let imported = 0;
    let lastJdId: string | null = null;

    for (const row of rows) {
      const f: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        const canonical = normalizeColName(key);
        if (canonical !== 'other') {
          f[canonical] = String(value).trim();
        }
      }

      // Build title: "Seniority Position Title" when both present
      const baseTitle = f['title'] || file.name.replace(/\.(xlsx|xls)$/i, '');
      if (!baseTitle) continue;
      const title = f['seniority'] ? `${f['seniority']} ${baseTitle}` : baseTitle;

      // Skills: primary → mandatory, preferred + tools → nice-to-have
      const skills: Skill[] = [
        ...splitSkills(f['primary_skills'] ?? '', 'mandatory'),
        ...splitSkills(f['preferred_skills'] ?? '', 'nice-to-have'),
        ...splitSkills(f['tools'] ?? '', 'nice-to-have'),
      ];

      // rawText: use job description if present, otherwise summarise fields
      const parts: string[] = [];
      if (f['description']) parts.push(f['description']);
      else {
        if (f['primary_skills']) parts.push(`Habilidades requeridas: ${f['primary_skills']}`);
        if (f['preferred_skills']) parts.push(`Habilidades valoradas: ${f['preferred_skills']}`);
        if (f['tools']) parts.push(`Herramientas: ${f['tools']}`);
        if (f['experience']) parts.push(`Experiencia mínima: ${f['experience']} años`);
        if (f['languages']) parts.push(`Idiomas: ${f['languages']}`);
      }
      const rawText = parts.join('\n\n');

      const jdId = crypto.randomUUID();
      await saveJd({
        id: jdId,
        title,
        rawText,
        skills,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      lastJdId = jdId;
      imported++;
    }

    if (lastJdId) {
      await setActiveJdId(lastJdId);
      statusEl.textContent = `${imported} oferta(s) importada(s). Última activada.`;
    } else {
      statusEl.textContent = 'No se encontraron filas válidas en el archivo.';
    }

    await renderJdList();
  } catch (err) {
    statusEl.textContent = `Error al leer el archivo: ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ---- Initialise ----

document.addEventListener('DOMContentLoaded', async () => {
  // Hide API key section when key is baked in at build time
  if (isApiKeyBuiltIn()) {
    const section = document.getElementById('claude-api-key-section') as HTMLElement;
    section.innerHTML = '<h2>Claude API Key</h2><p style="color:#555; font-size:0.9rem;">API key is pre-configured.</p>';
  } else {
    await updateClaudeApiKeyIndicator();
    const claudeSaveBtn = document.getElementById('claude-api-key-save-btn') as HTMLButtonElement;
    claudeSaveBtn.addEventListener('click', () => void handleApiKeySave());
    const claudeClearBtn = document.getElementById('claude-api-key-clear-btn') as HTMLButtonElement;
    claudeClearBtn.addEventListener('click', () => void handleApiKeyClear());
  }

  await renderJdList(); // also calls renderActiveJdSelector

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

  // Excel import
  const excelInput = document.getElementById('jd-excel-input') as HTMLInputElement;
  excelInput?.addEventListener('change', async () => {
    const file = excelInput.files?.[0];
    if (!file) return;
    await handleExcelImport(file);
    excelInput.value = ''; // reset so same file can be re-selected
  });
});
