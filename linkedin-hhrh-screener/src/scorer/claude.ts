// src/scorer/claude.ts
// AI refinement: skill inference, experience-depth analysis, and red flags.

import type { CandidateProfile } from '../parser/types';
import type { Skill } from '../storage/schema';
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
const ROLE_IMPLIED_SKILLS = `
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

function buildPrompt(profile: CandidateProfile, unmatchedSkills: Skill[], allJdSkills: Skill[]): string {
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
    ROLE_IMPLIED_SKILLS,
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
    '',
    'Responde SOLO con JSON válido, sin bloques de código ni texto adicional:',
    '{"additionalMatches":[],"impliedByExperience":[],"experienceLevel":"mid","rationale":"...","redFlags":[{"flag":"...","question":"...","expectedAnswer":"..."}]}',
  ].join('\n');
}

function buildAllMatchedPrompt(profile: CandidateProfile, allJdSkills: Skill[]): string {
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
    ROLE_IMPLIED_SKILLS,
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
    '',
    'Responde SOLO con JSON válido, sin bloques de código ni texto adicional:',
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
): Promise<RefinementResult> {
  const empty: RefinementResult = {
    additionalMatches: [],
    impliedByExperience: [],
    experienceLevel: 'mid',
    rationale: '',
    redFlags: [],
  };

  const prompt = unmatchedSkills.length === 0
    ? buildAllMatchedPrompt(profile, allJdSkills)
    : buildPrompt(profile, unmatchedSkills, allJdSkills);

  const result = await anthropicComplete(apiKey, prompt, 'claude-haiku-4-5-20251001', 2048);

  if (result.error) {
    if (result.error === 'auth') return { ...empty, claudeError: '401' };
    if (result.error.includes('Network')) return { ...empty, claudeError: 'network' };
    return { ...empty, claudeError: result.error };
  }

  return parseRefinementResponse(result.text);
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
