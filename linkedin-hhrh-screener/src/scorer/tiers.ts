// src/scorer/tiers.ts
// Tier thresholds and label assignment.
// Wave 0: skeleton only — assignTier throws 'not implemented'.
// Wave 1 (plan 03-02) will implement the real logic.

export type Tier = 'L1' | 'L2' | 'L3' | 'rejected';

export const TIER_LABELS: Record<Tier, string> = {
  L1: '',
  L2: '',
  L3: '',
  rejected: '',
};

export function assignTier(_score: number): Tier {
  throw new Error('not implemented');
}
