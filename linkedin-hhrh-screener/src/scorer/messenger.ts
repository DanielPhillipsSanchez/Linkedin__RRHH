import type { CandidateProfile } from '../parser/types';
import type { Tier } from './tiers';
import { anthropicComplete } from './anthropic';

const TIER_CONTEXT: Record<Exclude<Tier, 'rejected'>, string> = {
  L1: 'Es un candidato muy bueno. Proponle hablar pronto.',
  L2: 'El perfil es interesante pero no perfecto. Pregúntale si estaría abierto a una charla.',
  L3: 'No es el momento ideal. Déjale la puerta abierta y dile que le escribirás en unos días.',
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

  return `Escribe un mensaje corto de LinkedIn de un recruiter a ${firstName}.

Contexto: ${TIER_CONTEXT[tier]}
Su trabajo actual: ${lastJob}
Puesto que buscamos: ${jdTitle}
Habilidades que coinciden: ${matchedSkills.slice(0, 4).join(', ') || 'varias'}

Cómo debe sonar: como un mensaje de WhatsApp entre conocidos profesionales. Directo, sin rodeos, sin halagos exagerados. Máximo 3 frases.

No uses: signos de exclamación, puntos suspensivos, "espero que", "me permito", "adjunto", "no dudes", "encantado", "tremenda", ni frases que suenen a plantilla.

Solo el texto del mensaje.`;
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
    return { message: '', error: 'Empty response from Claude API' };
  }

  return { message: result.text };
}
