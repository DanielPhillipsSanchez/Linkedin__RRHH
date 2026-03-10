import type { CandidateProfile } from '../parser/types';
import type { Tier } from './tiers';
import { anthropicComplete } from './anthropic';

const TIER_CONTEXT: Record<Exclude<Tier, 'rejected'>, string> = {
  L1: 'El candidato encaja muy bien. Quiero proponerle una llamada esta semana.',
  L2: 'El candidato es interesante aunque no es un encaje perfecto. Quiero preguntarle si estaría abierto a hablar.',
  L3: 'No es el momento ideal pero quiero dejarle la puerta abierta y decirle que le escribo en unos días.',
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

  return `Escribe exactamente dos frases en español colombiano para un mensaje de LinkedIn de un recruiter a ${firstName}.

Intención: ${TIER_CONTEXT[tier]}
Experiencia del candidato: ${lastJob}
Cargo que busco cubrir: ${jdTitle}
Habilidades que coinciden: ${matchedSkills.slice(0, 3).join(', ') || 'varias'}

Reglas estrictas:
- Español colombiano: usa "usted" (no "tú"), di "hoja de vida" (no "currículum"), "celular" (no "móvil"), "listo" o "bien" (no "vale" ni "guay")
- Primera persona del singular (yo, me, mi)
- Exactamente dos frases, sin más
- Tono directo y cercano, como hablaría un colega en Colombia
- Sin anglicismos, sin palabras de España
- Prohibido: signos de exclamación, puntos suspensivos, "espero que esté bien", "me permito", "no dude", "adjunto", "oportunidad", "encantado"
- Solo el texto del mensaje, sin saludo adicional ni firma`;
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
