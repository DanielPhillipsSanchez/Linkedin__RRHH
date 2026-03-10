import type { CandidateProfile } from '../parser/types';
import type { Tier } from './tiers';
import { anthropicComplete } from './anthropic';

const TONE_MAP: Record<Exclude<Tier, 'rejected'>, string> = {
  L1: 'El candidato encaja muy bien. Muestra interés directo en hablar con él sobre la posición.',
  L2: 'El candidato tiene un perfil interesante. Pregúntale si estaría abierto a una conversación informal sobre la posición.',
  L3: 'El candidato no es el perfil ideal ahora mismo. Déjale la puerta abierta para más adelante y menciona que le escribirás en unos días.',
};

function buildMessagePrompt(
  profile: CandidateProfile,
  tier: Exclude<Tier, 'rejected'>,
  matchedSkills: string[],
  missingSkills: string[],
  jdTitle: string,
): string {
  const toneInstruction = TONE_MAP[tier];
  const titles = profile.experience.map((e) => `${e.title} en ${e.company}`).join(', ');
  const firstName = profile.name.split(' ')[0];

  return `Escribe un mensaje de LinkedIn de un recruiter a un candidato en español.

Instrucción de tono: ${toneInstruction}

Datos del candidato:
- Nombre: ${firstName}
- Experiencia: ${titles || 'no disponible'}
- Puesto buscado: ${jdTitle}
- Habilidades que tiene: ${matchedSkills.join(', ') || 'ninguna identificada'}
- Habilidades que le faltan: ${missingSkills.join(', ') || 'ninguna'}

Reglas:
- Escríbelo como lo haría una persona real, no un sistema de IA
- Usa el nombre de pila del candidato
- Menciona algo concreto de su experiencia
- Frases cortas y directas, sin adornos
- Sin guiones largos, sin puntos suspensivos, sin signos de exclamación múltiples
- Sin palabras como: "encantado", "apasionante", "tremenda", "increíble", "oportunidad única", "perfil ideal"
- Máximo 150 palabras
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
  const prompt = buildMessagePrompt(profile, tier, matchedSkills, missingSkills, jdTitle);
  const result = await anthropicComplete(apiKey, prompt);

  if (result.error) {
    return { message: '', error: result.error };
  }

  if (!result.text) {
    return { message: '', error: 'Empty response from Claude API' };
  }

  return { message: result.text };
}
