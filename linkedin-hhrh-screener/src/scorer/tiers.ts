// src/scorer/tiers.ts
// Tier thresholds and label assignment.

import type { Lang } from '../i18n';
import { T } from '../i18n';

export type Tier = 'high' | 'medium' | 'low' | 'rejected';

export function getTierLabels(lang: Lang): Record<Tier, string> {
  const t = T[lang];
  return {
    high: t.tierHigh,
    medium: t.tierMedium,
    low: t.tierLow,
    rejected: t.tierRejected,
  };
}

// Default English labels for backward-compatible usage
export const TIER_LABELS: Record<Tier, string> = getTierLabels('es');

/**
 * Maps a score (0–100) to a candidate tier.
 *
 * Unified thresholds — no longer split by skill count because the 80/20
 * mandatory/nice-to-have formula already normalises JDs of any size.
 *
 * Rationale:
 *   - Matching all mandatory skills always yields ≥ 80, so high at 75 means
 *     a candidate can miss one mandatory and still reach high if they cover
 *     enough nice-to-have skills.
 *   - Profiles on LinkedIn are never complete — implied skills matter and
 *     the Claude pass already credits them; thresholds must reflect that.
 *
 *   >= 75 → high   (muy buen encaje)
 *   >= 63 → medium (buen encaje con alguna brecha menor)
 *   >= 50 → low    (encaje parcial, vale la pena explorar)
 *   <  50 → rejected
 */
export function assignTier(score: number, _skillCount = 0): Tier {
  if (score >= 75) return 'high';
  if (score >= 63) return 'medium';
  if (score >= 50) return 'low';
  return 'rejected';
}
