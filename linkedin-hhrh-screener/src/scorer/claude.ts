// src/scorer/claude.ts
// Claude API refinement call for ambiguous/synonym skills.
// Wave 0: skeleton only — refineWithClaude throws 'not implemented'.
// Wave 1 (plan 03-03) will implement the real logic.

import type { CandidateProfile } from '../parser/types';
import type { Skill } from '../storage/schema';

export async function refineWithClaude(
  _apiKey: string,
  _profile: CandidateProfile,
  _unmatchedSkills: Skill[],
): Promise<{ additionalMatches: string[]; rationale: string }> {
  throw new Error('not implemented');
}
