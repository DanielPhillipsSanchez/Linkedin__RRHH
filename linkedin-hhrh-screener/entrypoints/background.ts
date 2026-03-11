import { getAnthropicApiKey, getActiveJdId, getAllJds, getAllCandidates, saveCandidate, getCandidate } from '../src/storage/storage';
import type { ProfileParsedMessage, EvaluateResult, GenerateMessageResult, SaveMessageResult, SavePhoneResult } from '../src/shared/messages';
import type { CandidateProfile, ExtractionHealth } from '../src/parser/types';
import type { CandidateRecord } from '../src/storage/schema';
import { runKeywordPass, computeScore } from '../src/scorer/scorer';
import { assignTier, TIER_LABELS } from '../src/scorer/tiers';
import { refineWithClaude } from '../src/scorer/claude';
import { generateOutreachMessage } from '../src/scorer/messenger';
import { validateAnthropicApiKey } from '../src/scorer/anthropic';

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

// SCHED-03: badge refresh — counts overdue uncontacted L3 candidates
export async function refreshBadge(): Promise<void> {
  const candidates = await getAllCandidates();
  const now = Date.now();
  const overdueCount = candidates.filter(
    (c) =>
      c.tier === 'L3' &&
      c.contactAfter !== undefined &&
      new Date(c.contactAfter).getTime() <= now &&
      !c.messageSentAt,
  ).length;
  const text = overdueCount > 0 ? String(overdueCount) : '';
  await browser.action.setBadgeText({ text });
  if (overdueCount > 0) {
    await browser.action.setBadgeBackgroundColor({ color: '#E53935' });
  }
}

export async function validateStoredCredentials(): Promise<{ valid: boolean; error?: string }> {
  const apiKey = await getAnthropicApiKey();
  if (!apiKey) return { valid: false, error: 'No Anthropic API key stored' };
  return validateAnthropicApiKey(apiKey);
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

  const apiKey = await getAnthropicApiKey();
  if (!apiKey) {
    return {
      score: 0,
      tier: 'rejected',
      tierLabel: TIER_LABELS['rejected'],
      matchedSkills: [],
      missingSkills: [],
      rationale: '',
      candidateId: '',
      error: 'No Anthropic API key — please add it in Options',
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

  // Build a full-text blob from about, headline, and experience titles for fallback matching
  const profileText = [
    profile.headline,
    profile.about,
    ...profile.experience.map((e) => `${e.title} ${e.company}`),
  ].join(' ');

  // Keyword pass — checks skills section first, then falls back to full profile text
  const { matchedSkills, unmatchedSkills } = runKeywordPass(jd.skills, profile.skills, profileText);

  // Claude refinement (skip if nothing unmatched)
  let additionalMatches: string[] = [];
  let rationale = '';
  let claudeWarning: string | undefined;
  if (unmatchedSkills.length > 0) {
    const refined = await refineWithClaude(apiKey, profile, unmatchedSkills);
    additionalMatches = refined.additionalMatches;
    rationale = refined.rationale;
    if (refined.claudeError === '401') {
      claudeWarning = 'Claude API auth failed — please update your API key in Options. Score shown is keyword-only.';
    } else if (refined.claudeError === 'network') {
      claudeWarning = 'Claude API unreachable — score is keyword-only.';
    } else if (refined.claudeError) {
      claudeWarning = `Claude API error: ${refined.claudeError} — score is keyword-only.`;
    }
  }

  // Final matched set
  const allMatchedTexts = new Set([...matchedSkills, ...additionalMatches]);
  const score = computeScore(jd.skills, allMatchedTexts);
  const tier = assignTier(score, jd.skills.length);
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

  // SCHED-01: create 7-day follow-up alarm for Layer 3 candidates
  if (record.contactAfter) {
    await browser.alarms.create(`l3-followup-${record.id}`, {
      when: new Date(record.contactAfter).getTime(),
    });
  }
  await refreshBadge();

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

export async function handleGenerateMessage(candidateId: string): Promise<GenerateMessageResult> {
  const candidate = await getCandidate(candidateId);
  if (!candidate) return { message: '', error: 'Candidate not found' };

  if (candidate.tier === 'rejected') return { message: '', error: 'No outreach message for rejected candidates' };

  const apiKey = await getAnthropicApiKey();
  if (!apiKey) return { message: '', error: 'No Anthropic API key — please configure it in Options' };

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
    apiKey,
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

  await refreshBadge(); // SCHED-03: badge decrements when candidate is marked as contacted

  return { saved: true };
}

export async function handleSavePhone(candidateId: string, phoneNumber: string): Promise<SavePhoneResult> {
  const candidate = await getCandidate(candidateId);
  if (!candidate) return { saved: false, error: 'Candidate not found' };

  candidate.phoneNumber = phoneNumber;
  await saveCandidate(candidate);

  return { saved: true };
}

// SCHED-02: alarm fire handler — exported for direct unit testability
export async function handleAlarm(alarm: { name: string; scheduledTime: number }): Promise<void> {
  if (!alarm.name.startsWith('l3-followup-')) return;
  const candidateId = alarm.name.replace('l3-followup-', '');
  const candidate = await getCandidate(candidateId);
  if (!candidate || candidate.messageSentAt) return; // already contacted
  await browser.notifications.create(`notif-${candidateId}`, {
    type: 'basic',
    iconUrl: browser.runtime.getURL('/icon/128.png'),
    title: 'L3 Follow-up Ready',
    message: `Time to contact ${candidate.name} — their 7-day window has opened.`,
  });
  await refreshBadge();
}

export default defineBackground(() => {
  // SCHED-02: show notification when 7-day alarm fires
  browser.alarms.onAlarm.addListener(handleAlarm);

  // SCHED-03: refresh badge on install and browser startup
  browser.runtime.onInstalled.addListener(() => { void refreshBadge(); });
  browser.runtime.onStartup.addListener(() => { void refreshBadge(); });

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

    if (message.type === 'SAVE_PHONE') {
      handleSavePhone(message.candidateId, message.phoneNumber).then(sendResponse).catch((err) => sendResponse({ saved: false, error: (err as Error).message }));
      return true;
    }
  });
});
