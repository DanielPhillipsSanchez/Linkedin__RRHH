// entrypoints/options/index.ts
// Options page controller — Anthropic API key + JD CRUD + skill editor + active JD

import { saveJd, getAllJds, deleteJd, setActiveJdId, getActiveJdId, saveAnthropicApiKey, getAnthropicApiKey, isApiKeyBuiltIn, getLang, setLang } from '../../src/storage/storage';
import type { JobDescription, Skill } from '../../src/storage/schema';
import type { Lang } from '../../src/i18n';
import { T } from '../../src/i18n';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { anthropicComplete } from '../../src/scorer/anthropic';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

let currentLang: Lang = 'es';

function t() { return T[currentLang]; }

// ---- Static translation ----

function applyStaticTranslations(): void {
  const tr = t();

  // Page title
  const pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = tr.settingsTitle;

  const heading = document.getElementById('settings-heading');
  if (heading) heading.textContent = tr.settingsHeading;

  const langBtn = document.getElementById('lang-toggle-btn') as HTMLButtonElement;
  if (langBtn) langBtn.textContent = tr.langToggle;

  // API key section
  const apiKeyTitle = document.getElementById('api-key-section-title');
  if (apiKeyTitle) apiKeyTitle.textContent = tr.apiKeySection;

  const apiKeyDesc = document.getElementById('api-key-desc');
  if (apiKeyDesc) apiKeyDesc.textContent = tr.apiKeyDesc;

  const apiKeyLabel = document.getElementById('api-key-label');
  if (apiKeyLabel) apiKeyLabel.textContent = tr.apiKeyLabel;

  const saveBtn = document.getElementById('claude-api-key-save-btn');
  if (saveBtn) saveBtn.textContent = tr.apiKeySaveBtn;

  const clearBtn = document.getElementById('claude-api-key-clear-btn');
  if (clearBtn) clearBtn.textContent = tr.apiKeyClearBtn;

  // Active job section
  const activeJobTitle = document.getElementById('active-job-title');
  if (activeJobTitle) activeJobTitle.textContent = tr.activeJobSection;

  const activeJobDesc = document.getElementById('active-job-desc');
  if (activeJobDesc) activeJobDesc.textContent = tr.activeJobDesc;

  // Jobs section
  const jobsSectionTitle = document.getElementById('jobs-section-title');
  if (jobsSectionTitle) jobsSectionTitle.textContent = tr.jobsSection;

  // Add job form
  const jobTitleLabel = document.getElementById('job-title-label');
  if (jobTitleLabel) jobTitleLabel.textContent = tr.jobTitleLabel;

  const jobRawTextLabel = document.getElementById('job-raw-text-label');
  if (jobRawTextLabel) jobRawTextLabel.textContent = tr.jobRawTextLabel;

  const jobRawTextInput = document.getElementById('jd-raw-text-input') as HTMLTextAreaElement;
  if (jobRawTextInput) jobRawTextInput.placeholder = tr.jobRawTextPlaceholder;

  const addJobBtn = document.getElementById('jd-add-btn');
  if (addJobBtn) addJobBtn.textContent = tr.addJobBtn;

  const importDesc = document.getElementById('import-desc');
  if (importDesc) importDesc.innerHTML = tr.importDesc;

  const selectFileLabel = document.getElementById('select-file-label');
  if (selectFileLabel) selectFileLabel.textContent = tr.selectFile;
}

// ---- Anthropic API Key ----

async function updateClaudeApiKeyIndicator(): Promise<void> {
  const indicator = document.getElementById('claude-api-key-indicator') as HTMLParagraphElement;
  const key = await getAnthropicApiKey();
  indicator.textContent = key ? t().apiKeySaved : t().apiKeyNone;
}

async function handleApiKeySave(): Promise<void> {
  const input = document.getElementById('claude-api-key-input') as HTMLInputElement;
  const status = document.getElementById('claude-api-key-status') as HTMLElement;
  const key = input.value.trim();

  if (!key) {
    status.textContent = t().enterApiKey;
    return;
  }

  await saveAnthropicApiKey(key);
  status.textContent = t().verifying;

  const result = await browser.runtime.sendMessage({ type: 'VALIDATE_API_KEY' }) as { valid: boolean; error?: string };

  if (result.valid) {
    status.textContent = t().apiKeyVerified;
    input.value = '';
    await updateClaudeApiKeyIndicator();
  } else {
    status.textContent = t().verifyError(result.error ?? '');
  }
}

async function handleApiKeyClear(): Promise<void> {
  const status = document.getElementById('claude-api-key-status') as HTMLElement;
  await saveAnthropicApiKey('');
  status.textContent = t().keyDeleted;
  await updateClaudeApiKeyIndicator();
}

// ---- Job Descriptions ----

function buildSkillEditorHtml(jd: JobDescription): string {
  const tr = t();
  const skillRows = jd.skills.map((skill, i) => `
    <div class="skill-row" data-skill-index="${i}">
      <span class="skill-text">${skill.text}</span>
      <label style="display:inline; font-weight:normal;">
        <input type="radio" name="skill-${jd.id}-${i}-weight" value="mandatory"
          ${skill.weight === 'mandatory' ? 'checked' : ''} data-weight-jd="${jd.id}" data-weight-index="${i}">
        ${tr.mandatory}
      </label>
      <label style="display:inline; font-weight:normal;">
        <input type="radio" name="skill-${jd.id}-${i}-weight" value="nice-to-have"
          ${skill.weight === 'nice-to-have' ? 'checked' : ''} data-weight-jd="${jd.id}" data-weight-index="${i}">
        ${tr.niceToHave}
      </label>
      <button data-remove-skill="${i}" data-jd-id="${jd.id}">×</button>
    </div>
  `).join('');

  return `
    <details>
      <summary>${tr.editSkills} (${jd.skills.length})</summary>
      <div class="skill-list-editor" data-jd-id="${jd.id}">
        ${skillRows || `<p style="color:#888; font-size:0.85em;">${tr.noSkillsYet}</p>`}
        <div class="add-skill-form">
          <input type="text" class="skill-text-input" placeholder="${tr.skillPlaceholder}">
          <select class="skill-weight-select">
            <option value="mandatory">${tr.mandatory}</option>
            <option value="nice-to-have">${tr.niceToHave}</option>
          </select>
          <button class="add-skill-btn" data-jd-id="${jd.id}">${tr.addSkill}</button>
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
    list.innerHTML = `<li><em>${t().noJobsSaved}</em></li>`;
    await renderActiveJdSelector();
    return;
  }

  jds.forEach(jd => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="jd-item-header">
        <strong>${jd.title}</strong>
        <span style="color:#666; font-size:0.85em;">(${jd.skills.length} ${t().skills})</span>
        <button data-delete-jd="${jd.id}">${t().deleteJob}</button>
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
    container.innerHTML = `<p><em>${t().addJobFirst}</em></p>`;
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

// ---- File JD Import ----

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

// ---- Skill extraction from free-form text ----

async function extractSkillsFromText(rawText: string): Promise<Skill[]> {
  // Prefer Claude when an API key is available — much more reliable than regex
  const apiKey = await getAnthropicApiKey();
  if (apiKey) {
    const skills = await extractSkillsWithClaude(apiKey, rawText);
    if (skills.length > 0) return skills;
  }
  // Fallback: simple heuristic extraction (works without API key)
  return extractSkillsHeuristic(rawText);
}

async function extractSkillsWithClaude(apiKey: string, rawText: string): Promise<Skill[]> {
  // Truncate to avoid hitting token limits — first 3000 chars usually contain the key info
  const excerpt = rawText.slice(0, 3000);
  const prompt = [
    'You are analyzing a job description. Extract all skills and technologies mentioned.',
    '',
    'Job description:',
    excerpt,
    '',
    'Respond with ONLY valid JSON — no explanation, no markdown fences:',
    '{"mandatory": ["skill1", "skill2"], "nice_to_have": ["skill3"]}',
    '',
    'mandatory: required skills, must-have, core competencies',
    'nice_to_have: preferred skills, bonus, deseable, se valora, a plus',
    'Keep each skill short (1-5 words). Include languages, frameworks, tools, technologies, methodologies.',
    'Return empty arrays if a category has no skills.',
  ].join('\n');

  const result = await anthropicComplete(apiKey, prompt);
  if (result.error || !result.text) return [];

  try {
    const start = result.text.indexOf('{');
    const end = result.text.lastIndexOf('}');
    if (start === -1 || end === -1) return [];
    const parsed = JSON.parse(result.text.slice(start, end + 1)) as {
      mandatory?: string[];
      nice_to_have?: string[];
    };
    const skills: Skill[] = [
      ...(parsed.mandatory ?? []).map(text => ({ text, weight: 'mandatory' as Skill['weight'] })),
      ...(parsed.nice_to_have ?? []).map(text => ({ text, weight: 'nice-to-have' as Skill['weight'] })),
    ];
    return skills.filter(s => s.text.trim().length > 0);
  } catch {
    return [];
  }
}

function extractSkillsHeuristic(text: string): Skill[] {
  const skills: Skill[] = [];
  const seen = new Set<string>();

  const addSkill = (raw: string, weight: Skill['weight']) => {
    const t = raw.trim().replace(/[.:;,*•·–—]+$/, '').trim();
    if (t.length < 2 || t.length > 60) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    skills.push({ text: t, weight });
  };

  const isMandatoryHeader = (s: string) =>
    /\b(requirements?|requisitos?|must.have|obligatorio|requerido|hard.skills?|technical.skills?|habilidades|competencias|tech.?stack|stack.t[eé]cnico|technologies|tecnolog[ií]as?|required)\b/i.test(s);
  const isNiceToHaveHeader = (s: string) =>
    /\b(nice.to.have|preferred|bonus|plus|deseable|valorable|se.valora|a.plus|advantageous)\b/i.test(s);
  const isNonSkillHeader = (s: string) =>
    /\b(responsabilidades|responsibilities|ofrecemos|benefits?|beneficios?|salary|salario|apply|empresa|company)\b/i.test(s);

  const lines = text.split(/\r?\n/);
  let currentWeight: Skill['weight'] = 'mandatory';
  let inSkillSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (isMandatoryHeader(trimmed)) { currentWeight = 'mandatory'; inSkillSection = true; continue; }
    if (isNiceToHaveHeader(trimmed)) { currentWeight = 'nice-to-have'; inSkillSection = true; continue; }
    if (isNonSkillHeader(trimmed)) { inSkillSection = false; continue; }
    if (!inSkillSection) continue;

    const lineWeight: Skill['weight'] = isNiceToHaveHeader(trimmed) ? 'nice-to-have' : currentWeight;

    const bulletMatch = trimmed.match(/^(?:[-*•·✓→►▪]|\d+[.)]) +(.+)$/);
    if (bulletMatch) {
      const item = bulletMatch[1].trim();
      if (item.split(' ').length <= 6) addSkill(item, lineWeight);
      continue;
    }

    if ((trimmed.includes(',') || trimmed.includes(';')) && !trimmed.endsWith('.')) {
      const parts = trimmed.split(/[,;]\s*/);
      if (parts.length >= 2 && parts.every(p => p.trim().split(' ').length <= 5)) {
        parts.forEach(p => addSkill(p, lineWeight));
        continue;
      }
    }

    if (trimmed.split(' ').length <= 4 && !/[.?!]$/.test(trimmed)) addSkill(trimmed, lineWeight);
  }

  return skills;
}

async function handleSpreadsheetImport(file: File, statusEl: HTMLElement): Promise<void> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });

  if (rows.length === 0) {
    statusEl.textContent = t().emptyFile;
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
    const baseTitle = f['title'] || file.name.replace(/\.(xlsx|xls|csv)$/i, '');
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
    statusEl.textContent = t().importedJobs(imported);
  } else {
    statusEl.textContent = t().noValidRows;
  }

  await renderJdList();
}

async function handleWordImport(file: File, statusEl: HTMLElement): Promise<void> {
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  const rawText = result.value.trim();

  if (!rawText) {
    statusEl.textContent = t().emptyWord;
    return;
  }

  const skills = await extractSkillsFromText(rawText);
  const title = file.name.replace(/\.(docx|doc)$/i, '');
  const jdId = crypto.randomUUID();
  await saveJd({
    id: jdId,
    title,
    rawText,
    skills,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await setActiveJdId(jdId);
  statusEl.textContent = t().importedWord(skills.length);
  await renderJdList();
}

async function handlePdfImport(file: File, statusEl: HTMLElement): Promise<void> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  const textParts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Group text items by Y position to reconstruct lines
    const byY = new Map<number, string[]>();
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const y = Math.round((item as { transform: number[] }).transform[5]);
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y)!.push(item.str);
    }
    // Sort top-to-bottom (PDF Y coords are bottom-up, so descending = top-down)
    const pageLines = [...byY.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, parts]) => parts.join(' ').trim())
      .filter(l => l.length > 0);
    textParts.push(pageLines.join('\n'));
  }

  const rawText = textParts.join('\n\n').trim();

  if (!rawText) {
    statusEl.textContent = t().emptyPdf;
    return;
  }

  const skills = await extractSkillsFromText(rawText);
  const title = file.name.replace(/\.pdf$/i, '');
  const jdId = crypto.randomUUID();
  await saveJd({
    id: jdId,
    title,
    rawText,
    skills,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await setActiveJdId(jdId);
  statusEl.textContent = t().importedPdf(skills.length);
  await renderJdList();
}

async function handleFileImport(file: File): Promise<void> {
  const statusEl = document.getElementById('jd-import-status') as HTMLElement;
  statusEl.textContent = t().processing;

  try {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
      await handleSpreadsheetImport(file, statusEl);
    } else if (ext === 'docx' || ext === 'doc') {
      await handleWordImport(file, statusEl);
    } else if (ext === 'pdf') {
      await handlePdfImport(file, statusEl);
    } else {
      statusEl.textContent = t().unsupportedFormat;
    }
  } catch (err) {
    statusEl.textContent = t().fileReadError(err instanceof Error ? err.message : String(err));
  }
}

// ---- Language toggle ----

async function switchLanguage(): Promise<void> {
  currentLang = currentLang === 'es' ? 'en' : 'es';
  await setLang(currentLang);
  applyStaticTranslations();
  if (isApiKeyBuiltIn()) {
    const section = document.getElementById('claude-api-key-section') as HTMLElement;
    if (section) section.innerHTML = `<h2>${t().apiKeySection}</h2><p style="color:#555; font-size:0.9rem;">${t().apiKeyBuiltIn}</p>`;
  }
  await renderJdList();
  await updateClaudeApiKeyIndicator();
}

// ---- Initialise ----

document.addEventListener('DOMContentLoaded', async () => {
  currentLang = await getLang();
  applyStaticTranslations();

  // Language toggle
  document.getElementById('lang-toggle-btn')?.addEventListener('click', () => {
    void switchLanguage();
  });

  // Hide API key section when key is baked in at build time
  if (isApiKeyBuiltIn()) {
    const section = document.getElementById('claude-api-key-section') as HTMLElement;
    section.innerHTML = `<h2>${t().apiKeySection}</h2><p style="color:#555; font-size:0.9rem;">${t().apiKeyBuiltIn}</p>`;
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

  // File import (Excel, CSV, Word, PDF)
  const fileInput = document.getElementById('jd-file-input') as HTMLInputElement;
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    await handleFileImport(file);
    fileInput.value = ''; // reset so same file can be re-selected
  });
});
