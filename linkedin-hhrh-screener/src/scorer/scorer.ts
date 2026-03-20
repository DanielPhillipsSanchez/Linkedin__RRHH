// src/scorer/scorer.ts
// Keyword-pass scoring logic.
// Wave 1 (plan 03-02): full implementation.

import type { Skill, ExperienceRequirement } from '../storage/schema';
import type { ExperienceEntry } from '../parser/types';

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
 * Parses a LinkedIn duration string like "2 yrs 3 mos" or "1 year 6 months" into decimal years.
 * Returns 0 if the string contains no recognizable time units.
 */
export function parseDurationToYears(duration: string): number {
  const yearMatch = duration.match(/(\d+)\s*(?:yr|yrs|year|years)/i);
  const monthMatch = duration.match(/(\d+)\s*(?:mo|mos|month|months)/i);
  const years = yearMatch ? parseInt(yearMatch[1], 10) : 0;
  const months = monthMatch ? parseInt(monthMatch[1], 10) : 0;
  return years + months / 12;
}

/**
 * Sums all parsed experience durations from a candidate's experience list.
 * Returns 0 if no duration data could be parsed (LinkedIn may omit durations).
 */
export function computeTotalExperienceYears(experience: ExperienceEntry[]): number {
  return experience.reduce((sum, e) => sum + parseDurationToYears(e.duration), 0);
}

/**
 * Checks whether a candidate's total years of experience satisfies the job requirement.
 *
 * Rules:
 *   'exact'   X years → accept X-1 to X+1 (e.g. "3 years" → 2–4)
 *   'minimum' X years → accept X to X+2   (e.g. "more than 3 years" → 3–5)
 *
 * Returns { passes, min, max } so the caller can build a rejection message.
 * If totalYears is 0 (not parseable), passes is always true (benefit of the doubt).
 */
export function checkExperienceRequirement(
  req: ExperienceRequirement,
  totalYears: number,
): { passes: boolean; min: number; max: number } {
  if (totalYears === 0) return { passes: true, min: 0, max: 0 };
  const min = req.type === 'exact' ? Math.max(0, req.years - 1) : req.years;
  const max = req.type === 'exact' ? req.years + 1 : req.years + 2;
  return { passes: totalYears >= min && totalYears <= max, min, max };
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
