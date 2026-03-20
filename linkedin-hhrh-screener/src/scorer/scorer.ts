// src/scorer/scorer.ts
// Keyword-pass scoring logic.
// Wave 1 (plan 03-02): full implementation.

import type { Skill } from '../storage/schema';

// Weights are only used as fallback; computeScore uses a two-bucket formula.
const _WEIGHT: Record<Skill['weight'], number> = {
  mandatory: 2,
  'nice-to-have': 1,
};

/** Strip punctuation, lowercase, and trim. */
function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

/**
 * Returns true if the JD skill appears in any candidate skill (or vice versa),
 * using bidirectional substring matching after normalisation.
 *
 * Examples:
 *   skillMatches('React', ['React.js'])  → true  ('react' ⊂ 'reactjs')
 *   skillMatches('Node.js', ['Node'])    → true  ('node' ⊂ 'nodejs', bidirectional)
 *   skillMatches('Python', ['Java'])     → false
 */
export function skillMatches(jdSkill: string, candidateSkills: string[]): boolean {
  const jdNorm = normalise(jdSkill);
  return candidateSkills.some((cs) => {
    const csNorm = normalise(cs);
    return csNorm.includes(jdNorm) || jdNorm.includes(csNorm);
  });
}

/**
 * Computes score using a two-bucket formula:
 *   mandatory skills  → 80% of the final score
 *   nice-to-have      → 20% of the final score
 *
 * This ensures a candidate who matches all mandatory skills always scores ≥ 80
 * regardless of how many nice-to-have skills the JD lists.
 * If a bucket is empty, its full weight flows to the other bucket so the
 * formula stays at 100% when all available skills match.
 */
export function computeScore(jdSkills: Skill[], matchedSkillTexts: Set<string>): number {
  if (jdSkills.length === 0) return 0;

  const mandatory = jdSkills.filter((s) => s.weight === 'mandatory');
  const niceToHave = jdSkills.filter((s) => s.weight === 'nice-to-have');

  const mandatoryMatched = mandatory.filter((s) => matchedSkillTexts.has(s.text)).length;
  const niceMatched = niceToHave.filter((s) => matchedSkillTexts.has(s.text)).length;

  const mandatoryScore = mandatory.length > 0 ? mandatoryMatched / mandatory.length : 1;
  const niceScore = niceToHave.length > 0 ? niceMatched / niceToHave.length : 1;

  // If only one bucket exists, treat the other as fully matched (weight collapses to 100%)
  if (mandatory.length === 0) return Math.round(niceScore * 100);
  if (niceToHave.length === 0) return Math.round(mandatoryScore * 100);

  return Math.round((mandatoryScore * 0.8 + niceScore * 0.2) * 100);
}

/**
 * Returns true if a JD skill appears as a whole word in free-form profile text
 * (about, headline, experience descriptions). Uses word-boundary matching.
 */
export function skillMatchesInText(jdSkill: string, text: string): boolean {
  const jdNorm = normalise(jdSkill);
  if (!jdNorm) return false;
  const textNorm = normalise(text);
  // Escape regex special chars and allow flexible whitespace between words
  const escaped = jdNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`).test(textNorm);
}

/**
 * Runs the keyword pass over JD skills vs candidate skills.
 * Falls back to searching profileText (about + headline + experience) if the
 * skill is not found in the LinkedIn Skills section.
 *
 * Returns:
 *   matchedSkills  — JD skill text strings that matched (for display and computeScore input)
 *   unmatchedSkills — full Skill objects that did NOT match (caller filters mandatory-only for missingSkills display)
 */
export function runKeywordPass(
  jdSkills: Skill[],
  candidateSkills: string[],
  profileText = '',
): { matchedSkills: string[]; unmatchedSkills: Skill[] } {
  const matchedSkills: string[] = [];
  const unmatchedSkills: Skill[] = [];

  for (const skill of jdSkills) {
    if (skillMatches(skill.text, candidateSkills) || skillMatchesInText(skill.text, profileText)) {
      matchedSkills.push(skill.text);
    } else {
      unmatchedSkills.push(skill);
    }
  }

  return { matchedSkills, unmatchedSkills };
}
