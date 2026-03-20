import type { CandidateProfile } from '../parser/types';
import type { Tier } from './tiers';
import { anthropicComplete } from './anthropic';

const TIER_CONTEXT: Record<Exclude<Tier, 'rejected'>, string> = {
  L1: 'El candidato encaja muy bien con el cargo. El tono es directo y con confianza.',
  L2: 'El candidato es interesante aunque no es un encaje perfecto. El tono es exploratorio, queremos conocerlo más.',
  L3: 'No es el momento ideal. El tono es amable, dejamos la puerta abierta para más adelante.',
};

function buildMessagePrompt(
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

Contexto: ${TIER_CONTEXT[tier]}
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

export async function generateOutreachMessage(
  apiKey: string,
  profile: CandidateProfile,
  tier: Exclude<Tier, 'rejected'>,
  matchedSkills: string[],
  missingSkills: string[],
  jdTitle: string,
): Promise<{ message: string; error?: string }> {
  const prompt = buildMessagePrompt(profile, tier, matchedSkills, jdTitle);
  const result = await anthropicComplete(apiKey, prompt);

  if (result.error) {
    return { message: '', error: result.error };
  }

  if (!result.text) {
    return { message: '', error: 'Respuesta vacía de la API de Claude' };
  }

  return { message: result.text };
}
