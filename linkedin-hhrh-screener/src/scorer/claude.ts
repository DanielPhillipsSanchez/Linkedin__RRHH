// src/scorer/claude.ts
// Claude API refinement call for ambiguous/synonym skills.
// Uses direct fetch (no @anthropic-ai/sdk) — safe for service worker context.

import type { CandidateProfile } from '../parser/types';
import type { Skill } from '../storage/schema';

/**
 * Extracts a JSON object string from text that may be wrapped in markdown code fences.
 * Uses indexOf/lastIndexOf to find the first '{' and last '}' boundaries.
 */
function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return '{}';
  return text.slice(start, end + 1);
}

/**
 * Builds the Claude prompt including candidate headline, about, experience titles,
 * and the list of unmatched skills to evaluate.
 */
function buildPrompt(profile: CandidateProfile, unmatchedSkills: Skill[]): string {
  const titles = profile.experience.map((e) => e.title).join(', ');
  const skillNames = unmatchedSkills.map((s) => s.text).join(', ');

  return [
    'You are evaluating a candidate for a job. Based only on the text below, determine which of these unmatched skills the candidate likely has (through synonyms, related experience, or implied knowledge).',
    '',
    `Candidate headline: ${profile.headline}`,
    `About: ${profile.about}`,
    `Experience titles: ${titles}`,
    '',
    `Unmatched skills to evaluate: ${skillNames}`,
    '',
    'Respond with ONLY valid JSON in this exact format:',
    '{"additionalMatches": ["skill1", "skill2"], "rationale": "2-3 sentence explanation of the overall match quality and tier assignment."}',
    '',
    'If none match, return: {"additionalMatches": [], "rationale": "..."}',
  ].join('\n');
}

/**
 * Calls the Claude Haiku API to resolve ambiguous skill synonyms.
 * Skips the API call entirely when unmatchedSkills is empty.
 * Returns graceful fallback on JSON parse failure or API errors — never throws.
 * On 401: returns { additionalMatches: [], rationale: 'Claude API key invalid...', claudeError: '401' }
 */
export async function refineWithClaude(
  apiKey: string,
  profile: CandidateProfile,
  unmatchedSkills: Skill[],
): Promise<{ additionalMatches: string[]; rationale: string; claudeError?: string }> {
  if (unmatchedSkills.length === 0) {
    return { additionalMatches: [], rationale: '' };
  }

  const prompt = buildPrompt(profile, unmatchedSkills);

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(25_000),
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch {
    // Network error or timeout — degrade gracefully
    return { additionalMatches: [], rationale: '', claudeError: 'network' };
  }

  if (!response.ok) {
    if (response.status === 401) {
      return {
        additionalMatches: [],
        rationale: '',
        claudeError: '401',
      };
    }
    // Other API errors (400, 404, 429, 500) — degrade gracefully
    return { additionalMatches: [], rationale: '', claudeError: String(response.status) };
  }

  const data = await response.json() as { content: Array<{ type: string; text: string }> };
  const text = data.content[0]?.text ?? '{}';

  try {
    const parsed = JSON.parse(extractJson(text)) as {
      additionalMatches?: string[];
      rationale?: string;
    };
    return {
      additionalMatches: parsed.additionalMatches ?? [],
      rationale: parsed.rationale ?? '',
    };
  } catch {
    return { additionalMatches: [], rationale: '' };
  }
}
