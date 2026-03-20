// src/scorer/tiers.ts
// Tier thresholds and label assignment.

export type Tier = 'L1' | 'L2' | 'L3' | 'rejected';

export const TIER_LABELS: Record<Tier, string> = {
  L1: 'Nivel 1 — Encaje alto',
  L2: 'Nivel 2 — Buen encaje',
  L3: 'Nivel 3 — Encaje parcial',
  rejected: 'Descartado',
};

/**
 * Maps a score (0–100) to a candidate tier.
 *
 * Unified thresholds — no longer split by skill count because the 80/20
 * mandatory/nice-to-have formula already normalises JDs of any size.
 *
 * Rationale:
 *   - Matching all mandatory skills always yields ≥ 80, so L1 at 75 means
 *     a candidate can miss one mandatory and still reach L1 if they cover
 *     enough nice-to-have skills.
 *   - Profiles on LinkedIn are never complete — implied skills matter and
 *     the Claude pass already credits them; thresholds must reflect that.
 *
 *   >= 75 → L1  (muy buen encaje)
 *   >= 63 → L2  (buen encaje con alguna brecha menor)
 *   >= 50 → L3  (encaje parcial, vale la pena explorar)
 *   <  50 → rejected
 */
export function assignTier(score: number, _skillCount = 0): Tier {
  if (score >= 75) return 'L1';
  if (score >= 63) return 'L2';
  if (score >= 50) return 'L3';
  return 'rejected';
}
