import type { CandidateProfile } from '../parser/types';
import type { Tier } from './tiers';
import { anthropicComplete } from './anthropic';

const TONE_MAP: Record<Exclude<Tier, 'rejected'>, { instruction: string }> = {
  L1: {
    instruction:
      'El candidato encaja muy bien con el perfil. Escríbele un mensaje directo y cercano mostrando interés genuino en su trayectoria y proponiéndole hablar pronto sobre la oportunidad.',
  },
  L2: {
    instruction:
      'El candidato tiene un perfil interesante aunque no es un encaje perfecto. Escríbele un mensaje natural expresando curiosidad por su experiencia y sugiriendo una conversación informal para conocer más.',
  },
  L3: {
    instruction:
      'El candidato tiene potencial pero no es el momento ideal. Escríbele un mensaje amable dejando la puerta abierta para futuras oportunidades y mencionando que te pondrás en contacto en aproximadamente una semana.',
  },
};

function buildMessagePrompt(
  profile: CandidateProfile,
  tier: Exclude<Tier, 'rejected'>,
  matchedSkills: string[],
  missingSkills: string[],
  jdTitle: string,
): string {
  const tone = TONE_MAP[tier];
  const titles = profile.experience.map((e) => `${e.title} en ${e.company}`).join('; ');
  const firstName = profile.name.split(' ')[0];

  return [
    'Eres un recruiter escribiendo un mensaje de LinkedIn en español. El mensaje debe sonar completamente natural, como si lo escribiera una persona real — no uses frases hechas de reclutador, no uses anglicismos innecesarios, no suenes a IA.',
    '',
    tone.instruction,
    '',
    `Nombre del candidato: ${profile.name} (usa solo su nombre de pila: ${firstName})`,
    `Titular de LinkedIn: ${profile.headline}`,
    `Experiencia: ${titles || 'No disponible'}`,
    `Puesto al que aplica: ${jdTitle}`,
    `Habilidades que coinciden: ${matchedSkills.join(', ') || 'Ninguna identificada'}`,
    `Habilidades que faltan: ${missingSkills.join(', ') || 'Ninguna'}`,
    '',
    'Reglas estrictas:',
    '- Escribe en español natural y conversacional, sin tecnicismos de RR.HH.',
    '- Máximo 200 palabras',
    '- Menciona algo concreto de su experiencia o perfil',
    '- No uses corchetes ni marcadores de posición — escribe directamente',
    '- Evita palabras como: "oportunidad única", "encaja perfectamente", "potencial", "perfil ideal", "reto apasionante"',
    '- No escribas asunto, firma ni formato JSON — solo el texto del mensaje',
  ].join('\n');
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
