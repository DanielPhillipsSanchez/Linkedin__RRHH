// src/scorer/tiers.ts
// Tier thresholds and label assignment.

export type Tier = 'L1' | 'L2' | 'L3' | 'rejected';

export const TIER_LABELS: Record<Tier, string> = {
  L1: 'Layer 1',
  L2: 'Layer 2',
  L3: 'Layer 3',
  rejected: 'Rejected',
};

/**
 * Maps a score (0–100) to a candidate tier.
 *
 * When the JD has more than 8 skills (detailed profile), lower thresholds apply
 * because exact keyword coverage naturally drops with larger skill sets:
 *   >= 60 → L1
 *   >= 54 → L2
 *   >= 49 → L3
 *   <  49 → rejected
 *
 * For JDs with 8 or fewer skills (standard profile):
 *   >= 80 → L1
 *   >= 71 → L2
 *   >= 60 → L3
 *   <  60 → rejected
 */
export function assignTier(score: number, skillCount = 0): Tier {
  if (skillCount > 8) {
    if (score >= 60) return 'L1';
    if (score >= 54) return 'L2';
    if (score >= 49) return 'L3';
    return 'rejected';
  }
  if (score >= 80) return 'L1';
  if (score >= 71) return 'L2';
  if (score >= 60) return 'L3';
  return 'rejected';
}
