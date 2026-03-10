// src/scorer/scorer.ts
// Keyword-pass scoring logic.
// Wave 0: skeleton only — all functions throw 'not implemented'.
// Wave 1 (plan 03-02) will implement the real logic.

import type { Skill } from '../storage/schema';

export function skillMatches(_jdSkill: string, _candidateSkills: string[]): boolean {
  throw new Error('not implemented');
}

export function computeScore(
  _jdSkills: Skill[],
  _matchedSkillTexts: Set<string>,
): number {
  throw new Error('not implemented');
}

export function runKeywordPass(
  _jdSkills: Skill[],
  _candidateSkills: string[],
): { matchedSkills: string[]; unmatchedSkills: Skill[] } {
  throw new Error('not implemented');
}
