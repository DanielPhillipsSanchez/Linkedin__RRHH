import type { CandidateProfile } from '../parser/types';
import type { Tier } from './tiers';

const TONE_MAP: Record<Exclude<Tier, 'rejected'>, { label: string; instruction: string }> = {
  L1: {
    label: 'direct and enthusiastic',
    instruction:
      'Write a direct, enthusiastic outreach message. The candidate is an excellent match — convey genuine excitement about their background and invite them to discuss the role immediately.',
  },
  L2: {
    label: 'exploratory',
    instruction:
      'Write an exploratory outreach message. The candidate is a strong but not perfect match — express interest in learning more about their experience and suggest an informal conversation about the opportunity.',
  },
  L3: {
    label: 'future-opportunity',
    instruction:
      'Write a future-opportunity outreach message. The candidate has potential but is not a top match right now — frame this as keeping in touch for upcoming roles, and note that you will follow up in about a week.',
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
  const titles = profile.experience.map((e) => `${e.title} at ${e.company}`).join('; ');

  return [
    `You are a professional recruiter writing a LinkedIn outreach message to a candidate. Tone: ${tone.label}.`,
    '',
    tone.instruction,
    '',
    `Candidate name: ${profile.name}`,
    `Headline: ${profile.headline}`,
    `Experience: ${titles || 'Not available'}`,
    `Role: ${jdTitle}`,
    `Matched skills: ${matchedSkills.join(', ') || 'None identified'}`,
    `Missing skills: ${missingSkills.join(', ') || 'None'}`,
    '',
    'Requirements:',
    '- Keep it under 300 words',
    '- Use the candidate\'s first name',
    '- Reference at least one specific thing from their experience',
    '- Do NOT use placeholder brackets like [Company Name] — write naturally',
    '- Return ONLY the message text, no subject line, no JSON wrapping',
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

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch {
    return { message: '', error: 'Network error generating message' };
  }

  if (!response.ok) {
    return { message: '', error: `Claude API error ${response.status}` };
  }

  const data = (await response.json()) as { content: Array<{ type: string; text: string }> };
  const text = data.content[0]?.text?.trim() ?? '';

  if (!text) {
    return { message: '', error: 'Claude returned empty message' };
  }

  return { message: text };
}
