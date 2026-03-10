import { getSnowflakeCredentials, getActiveJdId, getAllJds, saveCandidate, getCandidate } from '../src/storage/storage';
import type { ProfileParsedMessage, EvaluateResult, GenerateMessageResult, SaveMessageResult } from '../src/shared/messages';
import type { CandidateProfile, ExtractionHealth } from '../src/parser/types';
import type { CandidateRecord } from '../src/storage/schema';
import { runKeywordPass, computeScore } from '../src/scorer/scorer';
import { assignTier, TIER_LABELS } from '../src/scorer/tiers';
import { refineWithClaude } from '../src/scorer/claude';
import { generateOutreachMessage } from '../src/scorer/messenger';
import { validateCortexCredentials } from '../src/scorer/cortex';

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

export async function validateStoredCredentials(): Promise<{ valid: boolean; error?: string }> {
  const creds = await getSnowflakeCredentials();
  if (!creds) return { valid: false, error: 'No Snowflake credentials stored' };
  return validateCortexCredentials(creds);
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

  const creds = await getSnowflakeCredentials();
  if (!creds) {
    return {
      score: 0,
      tier: 'rejected',
      tierLabel: TIER_LABELS['rejected'],
      matchedSkills: [],
      missingSkills: [],
      rationale: '',
      candidateId: '',
      error: 'No Snowflake credentials — please configure them in Options',
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

  // Cortex refinement (skip if nothing unmatched)
  let additionalMatches: string[] = [];
  let rationale = '';
  let cortexWarning: string | undefined;
  if (unmatchedSkills.length > 0) {
    const refined = await refineWithClaude(creds, profile, unmatchedSkills);
    additionalMatches = refined.additionalMatches;
    rationale = refined.rationale;
    if (refined.claudeError === '401') {
      cortexWarning = 'Snowflake auth failed — please update credentials in Options. Score shown is keyword-only.';
    } else if (refined.claudeError === 'network') {
      cortexWarning = 'Snowflake unreachable — score is keyword-only.';
    } else if (refined.claudeError) {
      cortexWarning = `Cortex error: ${refined.claudeError} — score is keyword-only.`;
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
    outreachMessage: '',
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
    ...(cortexWarning ? { warning: cortexWarning } : {}),
  };
}

export async function handleGenerateMessage(candidateId: string): Promise<GenerateMessageResult> {
  const candidate = await getCandidate(candidateId);
  if (!candidate) return { message: '', error: 'Candidate not found' };

  if (candidate.tier === 'rejected') return { message: '', error: 'No outreach message for rejected candidates' };

  const creds = await getSnowflakeCredentials();
  if (!creds) return { message: '', error: 'No Snowflake credentials — please configure them in Options' };

  const jds = await getAllJds();
  const jd = jds.find((j) => j.id === candidate.jdId);
  const jdTitle = jd?.title ?? 'the open role';

  const stored = getLastParsedProfile();
  const profile: CandidateProfile = stored?.profile ?? {
    name: candidate.name,
    headline: candidate.linkedinHeadline,
    about: '',
    skills: candidate.matchedSkills,
    experience: [],
    education: [],
    profileUrl: candidate.profileUrl,
  };

  const result = await generateOutreachMessage(
    creds,
    profile,
    candidate.tier as Exclude<typeof candidate.tier, 'rejected'>,
    candidate.matchedSkills,
    candidate.missingSkills,
    jdTitle,
  );

  if (result.message) {
    candidate.outreachMessage = result.message;
    await saveCandidate(candidate);
  }

  return result;
}

export async function handleSaveMessage(candidateId: string, messageText: string): Promise<SaveMessageResult> {
  const candidate = await getCandidate(candidateId);
  if (!candidate) return { saved: false, error: 'Candidate not found' };

  candidate.messageSentText = messageText;
  candidate.messageSentAt = new Date().toISOString();
  await saveCandidate(candidate);

  return { saved: true };
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'VALIDATE_API_KEY') {
      validateStoredCredentials().then(sendResponse);
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

    if (message.type === 'GENERATE_MESSAGE') {
      handleGenerateMessage(message.candidateId).then(sendResponse).catch((err) => sendResponse({ message: '', error: (err as Error).message }));
      return true;
    }

    if (message.type === 'SAVE_MESSAGE') {
      handleSaveMessage(message.candidateId, message.messageText).then(sendResponse).catch((err) => sendResponse({ saved: false, error: (err as Error).message }));
      return true;
    }
  });
});
