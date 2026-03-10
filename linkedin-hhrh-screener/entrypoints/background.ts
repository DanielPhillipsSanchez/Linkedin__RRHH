import { getApiKey, getActiveJdId, getAllJds, saveCandidate } from '../src/storage/storage';
import type { ProfileParsedMessage, EvaluateResult } from '../src/shared/messages';
import type { CandidateProfile, ExtractionHealth } from '../src/parser/types';
import type { CandidateRecord } from '../src/storage/schema';
import { runKeywordPass, computeScore } from '../src/scorer/scorer';
import { assignTier, TIER_LABELS } from '../src/scorer/tiers';
import { refineWithClaude } from '../src/scorer/claude';

let lastParsedProfile: { profile: CandidateProfile; health: ExtractionHealth } | null = null;

export function getLastParsedProfile(): { profile: CandidateProfile; health: ExtractionHealth } | null {
  return lastParsedProfile;
}

/** @internal For unit testing only — allows tests to pre-set profile state without message round-trip */
export function _setLastParsedProfileForTest(
  value: { profile: CandidateProfile; health: ExtractionHealth } | null,
): void {
  lastParsedProfile = value;
}

export async function validateStoredApiKey(): Promise<{ valid: boolean; error?: string }> {
  const apiKey = await getApiKey();
  if (!apiKey) return { valid: false, error: 'No API key stored' };

  try {
    const response = await fetch('https://api.anthropic.com/v1/models?limit=1', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    });

    if (response.ok) return { valid: true };
    if (response.status === 401) return { valid: false, error: 'Invalid API key' };
    return { valid: false, error: `HTTP ${response.status}` };
  } catch {
    return { valid: false, error: 'Network error — check your connection' };
  }
}

export async function handleEvaluate(): Promise<EvaluateResult> {
  const stored = getLastParsedProfile();
  if (!stored) {
    return {
      score: 0,
      tier: 'rejected',
      tierLabel: TIER_LABELS['rejected'],
      matchedSkills: [],
      missingSkills: [],
      rationale: '',
      candidateId: '',
      error: 'No profile data — please wait for the page to fully load',
    };
  }

  const apiKey = await getApiKey();
  if (!apiKey) {
    return {
      score: 0,
      tier: 'rejected',
      tierLabel: TIER_LABELS['rejected'],
      matchedSkills: [],
      missingSkills: [],
      rationale: '',
      candidateId: '',
      error: 'No API key — please add your Claude API key in Options',
    };
  }

  const activeJdId = await getActiveJdId();
  if (!activeJdId) {
    return {
      score: 0,
      tier: 'rejected',
      tierLabel: TIER_LABELS['rejected'],
      matchedSkills: [],
      missingSkills: [],
      rationale: '',
      candidateId: '',
      error: 'No active JD — please select a job description in Options',
    };
  }

  const jds = await getAllJds();
  const jd = jds.find((j) => j.id === activeJdId);
  if (!jd) {
    return {
      score: 0,
      tier: 'rejected',
      tierLabel: TIER_LABELS['rejected'],
      matchedSkills: [],
      missingSkills: [],
      rationale: '',
      candidateId: '',
      error: 'Active JD not found — please re-select a job description in Options',
    };
  }
  if (jd.skills.length === 0) {
    return {
      score: 0,
      tier: 'rejected',
      tierLabel: TIER_LABELS['rejected'],
      matchedSkills: [],
      missingSkills: [],
      rationale: '',
      candidateId: '',
      error: 'Active JD has no skills — please add skills in Options before evaluating',
    };
  }

  const { profile } = stored;

  // Keyword pass
  const { matchedSkills, unmatchedSkills } = runKeywordPass(jd.skills, profile.skills);

  // Claude refinement (skip if nothing unmatched)
  let additionalMatches: string[] = [];
  let rationale = '';
  let claudeWarning: string | undefined;
  if (unmatchedSkills.length > 0) {
    const refined = await refineWithClaude(apiKey, profile, unmatchedSkills);
    additionalMatches = refined.additionalMatches;
    rationale = refined.rationale;
    if (refined.claudeError === '401') {
      claudeWarning = 'Claude API key invalid — please update it in Options. Score shown is keyword-only.';
    } else if (refined.claudeError === 'network') {
      claudeWarning = 'Claude API unreachable — score is keyword-only.';
    } else if (refined.claudeError) {
      claudeWarning = `Claude API error ${refined.claudeError} — score is keyword-only.`;
    }
  }

  // Final matched set
  const allMatchedTexts = new Set([...matchedSkills, ...additionalMatches]);
  const score = computeScore(jd.skills, allMatchedTexts);
  const tier = assignTier(score);
  const tierLabel = TIER_LABELS[tier];

  // Missing skills: mandatory skills not in final matched set
  const missingSkills = jd.skills
    .filter((s) => s.weight === 'mandatory' && !allMatchedTexts.has(s.text))
    .map((s) => s.text);

  // Build record
  const now = new Date().toISOString();
  const record: CandidateRecord = {
    id: crypto.randomUUID(),
    name: profile.name,
    profileUrl: profile.profileUrl,
    linkedinHeadline: profile.headline,
    score,
    tier,
    matchedSkills: [...allMatchedTexts],
    missingSkills,
    outreachMessage: '', // Phase 4 fills this
    evaluatedAt: now,
    contactAfter:
      tier === 'L3' ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : undefined,
    jdId: jd.id,
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  };

  await saveCandidate(record);

  return {
    score,
    tier,
    tierLabel,
    matchedSkills: [...allMatchedTexts],
    missingSkills,
    rationale,
    candidateId: record.id,
    ...(claudeWarning ? { warning: claudeWarning } : {}),
  };
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'VALIDATE_API_KEY') {
      validateStoredApiKey().then(sendResponse);
      return true; // CRITICAL: keep channel open for async response
    }

    if (message.type === 'PROFILE_PARSED') {
      const msg = message as ProfileParsedMessage;
      lastParsedProfile = { profile: msg.profile, health: msg.health };
      console.log('[HHRH] Profile parsed:', msg.profile.name, '| Health ok:', msg.health.ok);
      sendResponse({ received: true });
      return true;
    }

    if (message.type === 'EVALUATE') {
      handleEvaluate().then(sendResponse).catch((err) => sendResponse({ error: (err as Error).message }));
      return true; // CRITICAL: keep channel open for async response
    }
  });
});
