// src/scorer/scorer.ts
// Keyword-pass scoring logic.
// Wave 1 (plan 03-02): full implementation.

import type { Skill } from '../storage/schema';

const WEIGHT: Record<Skill['weight'], number> = {
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
 * Computes weighted score as a rounded percentage.
 *
 * mandatory skills contribute 2 points, nice-to-have contribute 1 point.
 * matchedSkillTexts is a Set of JD skill text strings (verbatim, as they appear in jdSkills[].text).
 * Returns 0 if total possible points is 0.
 */
export function computeScore(jdSkills: Skill[], matchedSkillTexts: Set<string>): number {
  if (jdSkills.length === 0) return 0;

  let totalPoints = 0;
  let matchedPoints = 0;

  for (const skill of jdSkills) {
    const points = WEIGHT[skill.weight];
    totalPoints += points;
    if (matchedSkillTexts.has(skill.text)) {
      matchedPoints += points;
    }
  }

  if (totalPoints === 0) return 0;
  return Math.round((matchedPoints / totalPoints) * 100);
}

/**
 * Runs the keyword pass over JD skills vs candidate skills.
 *
 * Returns:
 *   matchedSkills  — JD skill text strings that matched (for display and computeScore input)
 *   unmatchedSkills — full Skill objects that did NOT match (caller filters mandatory-only for missingSkills display)
 */
export function runKeywordPass(
  jdSkills: Skill[],
  candidateSkills: string[],
): { matchedSkills: string[]; unmatchedSkills: Skill[] } {
  const matchedSkills: string[] = [];
  const unmatchedSkills: Skill[] = [];

  for (const skill of jdSkills) {
    if (skillMatches(skill.text, candidateSkills)) {
      matchedSkills.push(skill.text);
    } else {
      unmatchedSkills.push(skill);
    }
  }

  return { matchedSkills, unmatchedSkills };
}
