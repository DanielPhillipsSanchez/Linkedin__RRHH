// src/scorer/tiers.ts
// Tier thresholds and label assignment.
// Wave 1 (plan 03-02): full implementation.

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
 * Exact thresholds (product requirement — not configurable):
 *   >= 80 → L1
 *   >= 71 → L2
 *   >= 60 → L3
 *   <  60 → rejected
 */
export function assignTier(score: number): Tier {
  if (score >= 80) return 'L1';
  if (score >= 71) return 'L2';
  if (score >= 60) return 'L3';
  return 'rejected';
}
