// src/scorer/claude.ts
// AI refinement: skill inference, experience-depth analysis, and red flags.

import type { CandidateProfile } from '../parser/types';
import type { Skill } from '../storage/schema';
import type { Lang } from '../i18n';
import { anthropicComplete } from './anthropic';

export type ExperienceLevel = 'junior' | 'mid' | 'senior' | 'staff';

export interface RedFlag {
  flag: string;          // The specific concern
  question: string;      // Interview question to probe it
  expectedAnswer: string; // What a qualified candidate would say
}

export interface RefinementResult {
  additionalMatches: string[];
  impliedByExperience: string[];
  experienceLevel: ExperienceLevel;
  rationale: string;
  redFlags: RedFlag[];
  claudeError?: string;
}

function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return '{}';
  return text.slice(start, end + 1);
}

// Standard tools assumed per role — used in both prompts to guide skill inference.
const ROLE_IMPLIED_SKILLS_ES = `
REGLA UNIVERSAL — GIT:
Git es una habilidad 100% inherente a TODOS los roles tech (desarrollo, datos, ML, QA, DevOps, seguridad, etc.).
Si el cargo del candidato es de naturaleza técnica, asume siempre que sabe git, sin importar si lo lista o no.
Nunca lo marques como brecha ni como red flag.

HABILIDADES IMPLÍCITAS POR ROL (asume que el candidato las tiene si trabaja en ese dominio,
aunque no las liste explícitamente en su perfil de LinkedIn):
- Data Scientist / ML: Python, numpy, pandas, scikit-learn, jupyter, matplotlib/seaborn, SQL
- ML Engineer / AI Engineer: Python, numpy, pandas, TensorFlow o PyTorch, docker, git, APIs REST
- Data Engineer: Python o Scala, SQL, Spark, Airflow, dbt, algún cloud (AWS/GCP/Azure), git
- Data Analyst: SQL, Excel o Google Sheets, Python o R, alguna herramienta BI (Tableau/PowerBI/Looker)
- Backend Engineer: git, REST APIs, SQL, algún framework web, testing unitario, Linux básico
- Frontend Engineer: git, HTML, CSS, JavaScript/TypeScript, npm/yarn, algún framework (React/Vue/Angular)
- Full Stack Engineer: git, HTML, CSS, JavaScript/TypeScript, REST APIs, SQL, algún framework
- DevOps / SRE / Platform: bash/shell, git, Linux, CI/CD, docker, Kubernetes básico, algún cloud
- Mobile Engineer (iOS): Swift, Xcode, git, UIKit o SwiftUI, REST APIs
- Mobile Engineer (Android): Kotlin o Java, Android Studio, git, REST APIs
- Seguridad / Security: Linux, redes TCP/IP, scripting (Python o bash), git
- QA / Testing: herramientas de test del stack tecnológico del rol, git, SQL básico
Si el cargo del candidato corresponde a uno de estos perfiles, incluye en impliedByExperience
las habilidades de esa lista que sean relevantes para el cargo Y estén sin detectar.`.trim();

const ROLE_IMPLIED_SKILLS_EN = `
UNIVERSAL RULE — GIT:
Git is a 100% inherent skill for ALL tech roles (engineering, data, ML, QA, DevOps, security, etc.).
If the candidate's role is technical in nature, always assume they know git, regardless of whether they list it.
Never flag it as a gap or a red flag.

ROLE-IMPLIED SKILLS (assume the candidate has these if they work in that domain,
even if not explicitly listed on their LinkedIn profile):
- Data Scientist / ML: Python, numpy, pandas, scikit-learn, jupyter, matplotlib/seaborn, SQL
- ML Engineer / AI Engineer: Python, numpy, pandas, TensorFlow or PyTorch, docker, git, REST APIs
- Data Engineer: Python or Scala, SQL, Spark, Airflow, dbt, some cloud (AWS/GCP/Azure), git
- Data Analyst: SQL, Excel or Google Sheets, Python or R, some BI tool (Tableau/PowerBI/Looker)
- Backend Engineer: git, REST APIs, SQL, some web framework, unit testing, basic Linux
- Frontend Engineer: git, HTML, CSS, JavaScript/TypeScript, npm/yarn, some framework (React/Vue/Angular)
- Full Stack Engineer: git, HTML, CSS, JavaScript/TypeScript, REST APIs, SQL, some framework
- DevOps / SRE / Platform: bash/shell, git, Linux, CI/CD, docker, basic Kubernetes, some cloud
- Mobile Engineer (iOS): Swift, Xcode, git, UIKit or SwiftUI, REST APIs
- Mobile Engineer (Android): Kotlin or Java, Android Studio, git, REST APIs
- Security: Linux, TCP/IP networking, scripting (Python or bash), git
- QA / Testing: testing tools for the role's tech stack, git, basic SQL
If the candidate's role matches one of these profiles, include in impliedByExperience
the skills from that list that are relevant to the role AND not yet detected.`.trim();

function buildPromptEs(profile: CandidateProfile, unmatchedSkills: Skill[], allJdSkills: Skill[]): string {
  const experienceList = profile.experience
    .map((e) => `  - ${e.title} en ${e.company}${e.duration ? ` (${e.duration})` : ''}`)
    .join('\n');

  const skillNames = unmatchedSkills.map((s) => s.text).join(', ');
  const listedSkills = profile.skills.slice(0, 30).join(', ');
  const mandatorySkills = allJdSkills.filter(s => s.weight === 'mandatory').map(s => s.text).join(', ');

  return [
    'Eres una recruitera técnica senior evaluando un candidato. Analiza su perfil en profundidad.',
    'Responde siempre en español. Usa un tono directo y profesional, sin rodeos ni lenguaje corporativo.',
    '',
    '--- PERFIL DEL CANDIDATO ---',
    `Titular: ${profile.headline}`,
    `Sobre mí: ${profile.about || '(no indicado)'}`,
    `Habilidades listadas: ${listedSkills || '(ninguna)'}`,
    '',
    'Experiencia laboral (cargo, empresa, duración):',
    experienceList || '  (no indicada)',
    '',
    '--- REQUISITOS DE LA OFERTA ---',
    `Habilidades OBLIGATORIAS (críticas para el cargo): ${mandatorySkills || '(ver lista de no evaluadas)'}`,
    `Habilidades secundarias / deseables (no bloqueantes): ${skillNames || '(todas coinciden por palabras clave)'}`,
    '',
    ROLE_IMPLIED_SKILLS_ES,
    '',
    '--- TUS TAREAS ---',
    '',
    '1. "additionalMatches" — de la lista de habilidades por evaluar: habilidades que el candidato',
    '   claramente tiene por sinónimos, herramientas relacionadas o contenido explícito del perfil.',
    '',
    '2. "impliedByExperience" — de la lista de habilidades por evaluar: habilidades que cualquier',
    '   profesional del rol de este candidato tendría en producción, aunque no las liste.',
    '   Sé GENEROSO: si el candidato lleva años trabajando como Data Scientist, asume que sabe',
    '   numpy y pandas. Si es Backend Engineer, asume que sabe git y SQL. No requieras evidencia',
    '   explícita para herramientas fundamentales del rol. Solo excluye lo que genuinamente sea',
    '   raro para ese perfil o que haya señales claras de que no lo domina.',
    '',
    '3. "experienceLevel" — clasifica el nivel de experiencia:',
    '   "junior" = menos de 3 años de experiencia relevante',
    '   "mid"    = entre 3 y 6 años',
    '   "senior" = entre 6 y 12 años',
    '   "staff"  = más de 12 años o nivel principal/arquitecto/VP',
    '',
    '4. "rationale" — 2 o 3 frases sobre el encaje general, puntos fuertes y brechas en habilidades obligatorias.',
    '   Escribe como si le estuvieras explicando a otra recruitera, con criterio y sin suavizar.',
    '',
    '5. "redFlags" — entre 2 y 4 preguntas de entrevista para este candidato concreto.',
    '   PRIORIDAD 1 — Preguntas técnicas de profundidad sobre habilidades OBLIGATORIAS:',
    '     Aunque el candidato las liste, verifica que tiene dominio real. Pregunta por proyectos concretos,',
    '     decisiones de diseño, problemas resueltos o herramientas usadas en producción.',
    '   PRIORIDAD 2 — Habilidades declaradas sin respaldo claro en la experiencia laboral.',
    '   PRIORIDAD 3 (solo si es muy llamativo) — Aspectos de trayectoria: pasos muy cortos (<6 meses),',
    '     brechas largas (>1 año) o desajuste de seniority evidente.',
    '   La mayoría de las alertas deben ser técnicas. Evita convertir brechas normales en red flags.',
    '   Por cada alerta incluye:',
    '   - "flag": el aspecto concreto a verificar (1 o 2 frases, cita evidencia del perfil)',
    '   - "question": una pregunta técnica específica para ESTE candidato, no genérica',
    '   - "expectedAnswer": qué respondería alguien con dominio real (conceptos, herramientas, situaciones concretas)',
    '',
    'Reglas:',
    '- En additionalMatches e impliedByExperience, usa solo habilidades de la lista secundaria por evaluar.',
    '- Las preguntas deben ser técnicas y específicas para este perfil.',
    '- Sé directa y honesta — un falso positivo le cuesta tiempo y dinero a la empresa.',
    '- Todo el texto debe estar en español.',
    '- IMPORTANTE sobre fechas: LinkedIn solo muestra mes y año, sin días exactos.',
    '  Si dos empleos comparten el mismo mes (ej: uno termina en feb 2026 y el siguiente empieza en feb 2026),',
    '  esto es una transición normal, NO un solapamiento. Nunca lo marques como red flag.',
    '',
    'Responde SOLO con JSON válido, sin bloques de código ni texto adicional:',
    '{"additionalMatches":[],"impliedByExperience":[],"experienceLevel":"mid","rationale":"...","redFlags":[{"flag":"...","question":"...","expectedAnswer":"..."}]}',
  ].join('\n');
}

function buildPromptEn(profile: CandidateProfile, unmatchedSkills: Skill[], allJdSkills: Skill[]): string {
  const experienceList = profile.experience
    .map((e) => `  - ${e.title} at ${e.company}${e.duration ? ` (${e.duration})` : ''}`)
    .join('\n');

  const skillNames = unmatchedSkills.map((s) => s.text).join(', ');
  const listedSkills = profile.skills.slice(0, 30).join(', ');
  const mandatorySkills = allJdSkills.filter(s => s.weight === 'mandatory').map(s => s.text).join(', ');

  return [
    'You are a senior technical recruiter evaluating a candidate. Analyze their profile in depth.',
    'Always respond in English. Use a direct and professional tone, no fluff or corporate speak.',
    '',
    '--- CANDIDATE PROFILE ---',
    `Headline: ${profile.headline}`,
    `About: ${profile.about || '(not provided)'}`,
    `Listed skills: ${listedSkills || '(none)'}`,
    '',
    'Work experience (title, company, duration):',
    experienceList || '  (not provided)',
    '',
    '--- JOB REQUIREMENTS ---',
    `MANDATORY skills (critical for the role): ${mandatorySkills || '(see unmatched list)'}`,
    `Secondary / preferred skills (not blockers): ${skillNames || '(all matched by keyword)'}`,
    '',
    ROLE_IMPLIED_SKILLS_EN,
    '',
    '--- YOUR TASKS ---',
    '',
    '1. "additionalMatches" — from the unmatched skills list: skills the candidate clearly has',
    '   via synonyms, related tools, or explicit profile content.',
    '',
    '2. "impliedByExperience" — from the unmatched skills list: skills any professional in this',
    '   candidate\'s role would have in production, even if not listed.',
    '   Be GENEROUS: if the candidate has years as a Data Scientist, assume they know numpy and',
    '   pandas. If Backend Engineer, assume git and SQL. Don\'t require explicit evidence for',
    '   fundamental tools of the role. Only exclude what is genuinely rare for that profile or',
    '   where there are clear signals they don\'t master it.',
    '',
    '3. "experienceLevel" — classify experience level:',
    '   "junior" = less than 3 years relevant experience',
    '   "mid"    = 3 to 6 years',
    '   "senior" = 6 to 12 years',
    '   "staff"  = more than 12 years or principal/architect/VP level',
    '',
    '4. "rationale" — 2 or 3 sentences on overall fit, strengths, and gaps in mandatory skills.',
    '   Write as if explaining to another recruiter, with judgment and without softening.',
    '',
    '5. "redFlags" — 2 to 4 interview questions for this specific candidate.',
    '   PRIORITY 1 — Technical depth questions on MANDATORY skills:',
    '     Even if the candidate lists them, verify real mastery. Ask about specific projects,',
    '     design decisions, problems solved, or tools used in production.',
    '   PRIORITY 2 — Declared skills without clear backing in work history.',
    '   PRIORITY 3 (only if very notable) — Career aspects: very short tenures (<6 months),',
    '     long gaps (>1 year), or obvious seniority mismatch.',
    '   Most alerts should be technical. Avoid turning normal gaps into red flags.',
    '   For each alert include:',
    '   - "flag": the specific concern to verify (1 or 2 sentences, cite profile evidence)',
    '   - "question": a specific technical question for THIS candidate, not generic',
    '   - "expectedAnswer": what someone with real mastery would answer (concepts, tools, concrete situations)',
    '',
    'Rules:',
    '- In additionalMatches and impliedByExperience, only use skills from the unmatched list.',
    '- Questions must be technical and specific to this profile.',
    '- Be direct and honest — a false positive costs the company time and money.',
    '- All text must be in English.',
    '- IMPORTANT about dates: LinkedIn only shows month and year, never exact days.',
    '  If two jobs share the same month (e.g., one ends Feb 2026 and the next starts Feb 2026),',
    '  this is a normal transition, NOT an overlap. Never flag it as a red flag.',
    '',
    'Respond ONLY with valid JSON, no code blocks or additional text:',
    '{"additionalMatches":[],"impliedByExperience":[],"experienceLevel":"mid","rationale":"...","redFlags":[{"flag":"...","question":"...","expectedAnswer":"..."}]}',
  ].join('\n');
}

function buildAllMatchedPromptEs(profile: CandidateProfile, allJdSkills: Skill[]): string {
  const experienceList = profile.experience
    .map((e) => `  - ${e.title} en ${e.company}${e.duration ? ` (${e.duration})` : ''}`)
    .join('\n');

  const listedSkills = profile.skills.slice(0, 30).join(', ');
  const mandatorySkills = allJdSkills.filter(s => s.weight === 'mandatory').map(s => s.text).join(', ');

  return [
    'Eres una recruitera técnica senior evaluando un candidato que ya cumple con todas las habilidades requeridas.',
    'Responde siempre en español. Usa un tono directo y profesional, sin rodeos ni lenguaje corporativo.',
    '',
    '--- PERFIL DEL CANDIDATO ---',
    `Titular: ${profile.headline}`,
    `Sobre mí: ${profile.about || '(no indicado)'}`,
    `Habilidades listadas: ${listedSkills || '(ninguna)'}`,
    '',
    'Experiencia laboral (cargo, empresa, duración):',
    experienceList || '  (no indicada)',
    '',
    ROLE_IMPLIED_SKILLS_ES,
    '',
    `Habilidades OBLIGATORIAS del cargo: ${mandatorySkills}`,
    '',
    '--- TUS TAREAS ---',
    '',
    '1. "experienceLevel": "junior"|"mid"|"senior"|"staff"',
    '',
    '2. "rationale": 2 o 3 frases sobre el encaje, puntos fuertes y observaciones relevantes.',
    '   Escribe como si se lo explicaras a otra recruitera, con criterio y sin suavizar.',
    '',
    '3. "redFlags": entre 2 y 4 preguntas de entrevista para este candidato concreto.',
    '   PRIORIDAD 1 — Preguntas técnicas de profundidad sobre habilidades OBLIGATORIAS:',
    '     Verifica dominio real, no solo que las liste. Pregunta por proyectos, decisiones de diseño,',
    '     problemas resueltos o uso en producción de esas tecnologías.',
    '   PRIORIDAD 2 — Habilidades declaradas sin respaldo claro en la experiencia laboral.',
    '   PRIORIDAD 3 (solo si es muy llamativo) — Aspectos de trayectoria: pasos muy cortos (<6 meses)',
    '     o brechas largas (>1 año). Evita marcar brechas normales como red flags.',
    '   Por cada alerta:',
    '   - "flag": el aspecto concreto a verificar (1 o 2 frases, cita evidencia del perfil)',
    '   - "question": pregunta técnica específica para ESTE candidato, no genérica',
    '   - "expectedAnswer": qué respondería alguien con dominio real (conceptos y herramientas concretas)',
    '',
    '- Todo el texto debe estar en español.',
    '- IMPORTANTE sobre fechas: LinkedIn solo muestra mes y año, sin días exactos.',
    '  Si dos empleos comparten el mismo mes (ej: uno termina en feb 2026 y el siguiente empieza en feb 2026),',
    '  esto es una transición normal, NO un solapamiento. Nunca lo marques como red flag.',
    '',
    'Responde SOLO con JSON válido, sin bloques de código ni texto adicional:',
    '{"experienceLevel":"senior","rationale":"...","redFlags":[{"flag":"...","question":"...","expectedAnswer":"..."}]}',
  ].join('\n');
}

function buildAllMatchedPromptEn(profile: CandidateProfile, allJdSkills: Skill[]): string {
  const experienceList = profile.experience
    .map((e) => `  - ${e.title} at ${e.company}${e.duration ? ` (${e.duration})` : ''}`)
    .join('\n');

  const listedSkills = profile.skills.slice(0, 30).join(', ');
  const mandatorySkills = allJdSkills.filter(s => s.weight === 'mandatory').map(s => s.text).join(', ');

  return [
    'You are a senior technical recruiter evaluating a candidate who already meets all required skills.',
    'Always respond in English. Use a direct and professional tone, no fluff or corporate speak.',
    '',
    '--- CANDIDATE PROFILE ---',
    `Headline: ${profile.headline}`,
    `About: ${profile.about || '(not provided)'}`,
    `Listed skills: ${listedSkills || '(none)'}`,
    '',
    'Work experience (title, company, duration):',
    experienceList || '  (not provided)',
    '',
    ROLE_IMPLIED_SKILLS_EN,
    '',
    `MANDATORY skills for the role: ${mandatorySkills}`,
    '',
    '--- YOUR TASKS ---',
    '',
    '1. "experienceLevel": "junior"|"mid"|"senior"|"staff"',
    '',
    '2. "rationale": 2 or 3 sentences on fit, strengths, and relevant observations.',
    '   Write as if explaining to another recruiter, with judgment and without softening.',
    '',
    '3. "redFlags": 2 to 4 interview questions for this specific candidate.',
    '   PRIORITY 1 — Technical depth questions on MANDATORY skills:',
    '     Verify real mastery, not just that they list them. Ask about projects, design decisions,',
    '     problems solved, or production use of those technologies.',
    '   PRIORITY 2 — Declared skills without clear backing in work history.',
    '   PRIORITY 3 (only if very notable) — Career aspects: very short tenures (<6 months)',
    '     or long gaps (>1 year). Avoid marking normal gaps as red flags.',
    '   For each alert:',
    '   - "flag": the specific concern to verify (1 or 2 sentences, cite profile evidence)',
    '   - "question": specific technical question for THIS candidate, not generic',
    '   - "expectedAnswer": what someone with real mastery would answer (concrete concepts and tools)',
    '',
    '- All text must be in English.',
    '- IMPORTANT about dates: LinkedIn only shows month and year, never exact days.',
    '  If two jobs share the same month (e.g., one ends Feb 2026 and the next starts Feb 2026),',
    '  this is a normal transition, NOT an overlap. Never flag it as a red flag.',
    '',
    'Respond ONLY with valid JSON, no code blocks or additional text:',
    '{"experienceLevel":"senior","rationale":"...","redFlags":[{"flag":"...","question":"...","expectedAnswer":"..."}]}',
  ].join('\n');
}

/**
 * Calls Claude to infer skills, assess experience depth, and generate red flags + interview questions.
 * Never throws — returns graceful fallback on any error.
 */
export async function refineWithClaude(
  apiKey: string,
  profile: CandidateProfile,
  unmatchedSkills: Skill[],
  allJdSkills: Skill[] = [],
  lang: Lang = 'es',
): Promise<RefinementResult> {
  const empty: RefinementResult = {
    additionalMatches: [],
    impliedByExperience: [],
    experienceLevel: 'mid',
    rationale: '',
    redFlags: [],
  };

  let prompt: string;
  if (unmatchedSkills.length === 0) {
    prompt = lang === 'en'
      ? buildAllMatchedPromptEn(profile, allJdSkills)
      : buildAllMatchedPromptEs(profile, allJdSkills);
  } else {
    prompt = lang === 'en'
      ? buildPromptEn(profile, unmatchedSkills, allJdSkills)
      : buildPromptEs(profile, unmatchedSkills, allJdSkills);
  }

  const result = await anthropicComplete(apiKey, prompt, 'claude-haiku-4-5-20251001', 2048);

  if (result.error) {
    if (result.error === 'auth') return { ...empty, claudeError: '401' };
    if (result.error.includes('Network')) return { ...empty, claudeError: 'network' };
    return { ...empty, claudeError: result.error };
  }

  return parseRefinementResponse(result.text);
}

/**
 * Translates rationale and red flags to the target language using Claude.
 * Returns the original content unchanged on any error.
 */
export async function translateEvaluation(
  apiKey: string,
  rationale: string,
  redFlags: RedFlag[],
  targetLang: Lang,
): Promise<{ rationale: string; redFlags: RedFlag[]; translationFailed?: true }> {
  if (!rationale && redFlags.length === 0) return { rationale, redFlags };

  const langName = targetLang === 'en' ? 'English' : 'Spanish';

  // Send input as JSON so Claude mirrors the same escaping in its output
  const inputJson = JSON.stringify({ rationale, redFlags });

  const prompt = [
    `Translate ALL text values in the following JSON to ${langName}.`,
    'Rules:',
    '- Keep technical terms, skill names, company names, and tool names unchanged.',
    '- Maintain the same professional, direct tone.',
    '- Translate every string field: rationale, flag, question, expectedAnswer.',
    '- Return ONLY valid JSON with the exact same structure. No code blocks, no extra text.',
    '',
    `Input JSON:\n${inputJson}`,
    '',
    'Output JSON:',
  ].join('\n');

  const result = await anthropicComplete(apiKey, prompt, 'claude-haiku-4-5-20251001', 4096);
  if (result.error || !result.text) return { rationale, redFlags, translationFailed: true };

  try {
    const start = result.text.indexOf('{');
    const end = result.text.lastIndexOf('}');
    if (start === -1 || end === -1) return { rationale, redFlags, translationFailed: true };
    const parsed = JSON.parse(result.text.slice(start, end + 1)) as {
      rationale?: string;
      redFlags?: RedFlag[];
    };

    const translatedRationale = parsed.rationale;
    const translatedRedFlags = parsed.redFlags;

    if (!translatedRationale && (!translatedRedFlags || translatedRedFlags.length === 0)) {
      return { rationale, redFlags, translationFailed: true };
    }

    return {
      rationale: translatedRationale ?? rationale,
      redFlags: translatedRedFlags ?? redFlags,
    };
  } catch {
    return { rationale, redFlags, translationFailed: true };
  }
}

function parseRefinementResponse(text: string): RefinementResult {
  const fallback: RefinementResult = {
    additionalMatches: [],
    impliedByExperience: [],
    experienceLevel: 'mid',
    rationale: '',
    redFlags: [],
  };

  try {
    const parsed = JSON.parse(extractJson(text)) as {
      additionalMatches?: string[];
      impliedByExperience?: string[];
      experienceLevel?: ExperienceLevel;
      rationale?: string;
      redFlags?: RedFlag[];
    };
    return {
      additionalMatches: parsed.additionalMatches ?? [],
      impliedByExperience: parsed.impliedByExperience ?? [],
      experienceLevel: parsed.experienceLevel ?? 'mid',
      rationale: parsed.rationale ?? '',
      redFlags: (parsed.redFlags ?? []).filter(
        (f) => f && typeof f.flag === 'string' && typeof f.question === 'string' && typeof f.expectedAnswer === 'string',
      ),
    };
  } catch {
    return fallback;
  }
}
