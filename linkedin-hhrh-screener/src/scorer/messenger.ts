import type { CandidateProfile } from '../parser/types';
import type { Tier } from './tiers';
import type { Lang } from '../i18n';
import { anthropicComplete } from './anthropic';

const TIER_CONTEXT_ES: Record<Exclude<Tier, 'rejected'>, string> = {
  high: 'El candidato encaja muy bien con el cargo. El tono es directo y con confianza.',
  medium: 'El candidato es interesante aunque no es un encaje perfecto. El tono es exploratorio, queremos conocerlo más.',
  low: 'No es el momento ideal. El tono es amable, dejamos la puerta abierta para más adelante.',
};

const TIER_CONTEXT_EN: Record<Exclude<Tier, 'rejected'>, string> = {
  high: 'The candidate is a great fit for the role. The tone is direct and confident.',
  medium: 'The candidate is interesting but not a perfect fit. The tone is exploratory — we want to learn more.',
  low: 'This is not the ideal moment. The tone is friendly, leaving the door open for later.',
};

function buildMessagePromptEs(
  profile: CandidateProfile,
  tier: Exclude<Tier, 'rejected'>,
  matchedSkills: string[],
  jdTitle: string,
): string {
  const firstName = profile.name.split(' ')[0];
  const lastJob = profile.experience[0]
    ? `${profile.experience[0].title} en ${profile.experience[0].company}`
    : profile.headline;

  return `Escribe un mensaje de LinkedIn en español colombiano de una recruitera a ${firstName}. El mensaje tiene tres partes claramente separadas por saltos de línea.

Contexto: ${TIER_CONTEXT_ES[tier]}
Experiencia del candidato: ${lastJob}
Cargo que buscamos cubrir: ${jdTitle}
Habilidades que coinciden: ${matchedSkills.slice(0, 4).join(', ') || 'varias'}

Estructura del mensaje:

PARTE 1 — Intro (máximo 2 líneas):
Saludo breve y personal usando "tu". Una frase que rompa el hielo de forma natural, como si fuera un mensaje entre conocidos. No uses "espero que estés bien" ni frases de plantilla.

PARTE 2 — Por qué te escribo (1 a 2 líneas):
En una o dos frases, di qué cargo buscamos y qué de su perfil o experiencia te llamó la atención. Directo, sin rodeos, sin palabras rimbombantes.

PARTE 3 — Cierre (1 línea):
Pídele su número de celular y que te diga el día y la hora que más le quede bien para una llamada corta.

Reglas:
- Español colombiano: "tú", "hoja de vida", "celular", "listo"
- Sin anglicismos, sin palabras de España (vale, guay, móvil, currículum)
- Sin signos de exclamación ni puntos suspensivos
- Sin comillas, corchetes ni marcadores de posición
- Sin palabras que suenen a robot o a texto generado: honestamente, realmente, sin duda, me complace, me alegra, quisiera, considero, en tal sentido
- Solo el texto del mensaje, sin asunto ni firma`;
}

function buildMessagePromptEn(
  profile: CandidateProfile,
  tier: Exclude<Tier, 'rejected'>,
  matchedSkills: string[],
  jdTitle: string,
): string {
  const firstName = profile.name.split(' ')[0];
  const lastJob = profile.experience[0]
    ? `${profile.experience[0].title} at ${profile.experience[0].company}`
    : profile.headline;

  return `Write a LinkedIn message in English from a recruiter to ${firstName}. The message has three clearly separated parts with line breaks.

Context: ${TIER_CONTEXT_EN[tier]}
Candidate experience: ${lastJob}
Role we are hiring for: ${jdTitle}
Matching skills: ${matchedSkills.slice(0, 4).join(', ') || 'several'}

Message structure:

PART 1 — Intro (maximum 2 lines):
Brief and personal greeting. A natural icebreaker, like a message between colleagues. Don't use "I hope this finds you well" or template phrases.

PART 2 — Why I'm reaching out (1 to 2 lines):
In one or two sentences, say what role we're hiring for and what stood out in their profile or experience. Direct, no fluff, no buzzwords.

PART 3 — Close (1 line):
Ask for their phone number and the best day and time for a short call.

Rules:
- Professional but conversational English
- No exclamation marks or ellipses
- No quotes, brackets, or placeholders
- No robotic or AI-generated-sounding words: honestly, truly, undoubtedly, I'm pleased, I'm excited to, I'd like to, I believe, in that regard
- Only the message text, no subject line or signature`;
}

export async function generateOutreachMessage(
  apiKey: string,
  profile: CandidateProfile,
  tier: Exclude<Tier, 'rejected'>,
  matchedSkills: string[],
  missingSkills: string[],
  jdTitle: string,
  lang: Lang = 'es',
): Promise<{ message: string; error?: string }> {
  const prompt = lang === 'en'
    ? buildMessagePromptEn(profile, tier, matchedSkills, jdTitle)
    : buildMessagePromptEs(profile, tier, matchedSkills, jdTitle);

  const result = await anthropicComplete(apiKey, prompt);

  if (result.error) {
    return { message: '', error: result.error };
  }

  if (!result.text) {
    return { message: '', error: lang === 'en' ? 'Empty response from Claude API' : 'Respuesta vacía de la API de Claude' };
  }

  return { message: result.text };
}
