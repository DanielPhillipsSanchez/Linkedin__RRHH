// src/scorer/claude.ts
// AI refinement call for ambiguous/synonym skills.
// Supports Snowflake Cortex (default) and direct Anthropic Claude API (Developer mode).

import type { CandidateProfile } from '../parser/types';
import type { Skill } from '../storage/schema';
import { cortexComplete, type CortexCredentials } from './cortex';
import { anthropicComplete } from './anthropic';

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
 * Builds the prompt including candidate headline, about, experience titles,
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
 * Calls Snowflake Cortex COMPLETE to resolve ambiguous skill synonyms.
 * Skips the call entirely when unmatchedSkills is empty.
 * Returns graceful fallback on JSON parse failure or API errors — never throws.
 */
export async function refineWithClaude(
  creds: CortexCredentials,
  profile: CandidateProfile,
  unmatchedSkills: Skill[],
): Promise<{ additionalMatches: string[]; rationale: string; claudeError?: string }> {
  if (unmatchedSkills.length === 0) {
    return { additionalMatches: [], rationale: '' };
  }

  const prompt = buildPrompt(profile, unmatchedSkills);
  const result = await cortexComplete(creds, prompt);

  if (result.error) {
    if (result.error.includes('auth')) {
      return { additionalMatches: [], rationale: '', claudeError: '401' };
    }
    if (result.error.includes('Network')) {
      return { additionalMatches: [], rationale: '', claudeError: 'network' };
    }
    return { additionalMatches: [], rationale: '', claudeError: result.error };
  }

  return parseRefinementResponse(result.text);
}

/**
 * Calls the Anthropic Claude API directly (Developer mode).
 * Skips the call entirely when unmatchedSkills is empty.
 * Returns graceful fallback on JSON parse failure or API errors — never throws.
 */
export async function refineWithAnthropicApi(
  apiKey: string,
  profile: CandidateProfile,
  unmatchedSkills: Skill[],
): Promise<{ additionalMatches: string[]; rationale: string; claudeError?: string }> {
  if (unmatchedSkills.length === 0) {
    return { additionalMatches: [], rationale: '' };
  }

  const prompt = buildPrompt(profile, unmatchedSkills);
  const result = await anthropicComplete(apiKey, prompt);

  if (result.error) {
    if (result.error === 'auth') {
      return { additionalMatches: [], rationale: '', claudeError: '401' };
    }
    if (result.error.includes('Network')) {
      return { additionalMatches: [], rationale: '', claudeError: 'network' };
    }
    return { additionalMatches: [], rationale: '', claudeError: result.error };
  }

  return parseRefinementResponse(result.text);
}

function parseRefinementResponse(text: string): { additionalMatches: string[]; rationale: string } {
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
