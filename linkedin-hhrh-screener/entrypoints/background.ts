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
      error: 'No hay datos del perfil — espera a que la página cargue del todo',
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
      error: 'No hay clave API de Anthropic — añádela en Ajustes',
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
      error: 'No hay ninguna oferta activa — selecciona una en Ajustes',
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
      error: 'La oferta activa no se encontró — vuelve a seleccionarla en Ajustes',
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
      error: 'La oferta activa no tiene habilidades — añádelas en Ajustes antes de evaluar',
    };
  }

  const { profile } = stored;

  // Deduplication: return cached result if this candidate+JD was already evaluated
  const existing = (await getAllCandidates()).find(
    (c) => c.profileUrl === profile.profileUrl && c.jdId === jd.id,
  );
  if (existing) {
    return {
      score: existing.score,
      tier: existing.tier,
      tierLabel: TIER_LABELS[existing.tier],
      matchedSkills: existing.matchedSkills,
      missingSkills: existing.missingSkills,
      rationale: existing.rationale ?? '',
      experienceLevel: existing.experienceLevel,
      redFlags: existing.redFlags ?? [],
      candidateId: existing.id,
    };
  }

  // Build a full-text blob from about, headline, and experience titles for fallback matching
  const profileText = [
    profile.headline,
    profile.about,
    ...profile.experience.map((e) => `${e.title} ${e.company}`),
  ].join(' ');

  // Keyword pass — checks skills section first, then falls back to full profile text
  const { matchedSkills, unmatchedSkills } = runKeywordPass(jd.skills, profile.skills, profileText);

  // Claude refinement — always called to get experience level + rationale
  // even when all skills matched via keyword pass
  let additionalMatches: string[] = [];
  let impliedByExperience: string[] = [];
  let experienceLevel: CandidateRecord['experienceLevel'] = undefined;
  let rationale = '';
  let redFlags: CandidateRecord['redFlags'] = [];
  let claudeWarning: string | undefined;

  const refined = await refineWithClaude(apiKey, profile, unmatchedSkills, jd.skills);
  additionalMatches = refined.additionalMatches;
  impliedByExperience = refined.impliedByExperience;
  experienceLevel = refined.experienceLevel;
  rationale = refined.rationale;
  redFlags = refined.redFlags;
  if (refined.claudeError === '401') {
    claudeWarning = 'Error de autenticación con la API de Claude — actualiza tu clave en Ajustes. La puntuación mostrada es solo por palabras clave.';
  } else if (refined.claudeError === 'network') {
    claudeWarning = 'No se pudo conectar con la API de Claude — la puntuación es solo por palabras clave.';
  } else if (refined.claudeError) {
    claudeWarning = `Error en la API de Claude: ${refined.claudeError} — puntuación solo por palabras clave.`;
  }

  // Final matched set: keyword matches + Claude synonym matches + experience-implied matches
  const allMatchedTexts = new Set([...matchedSkills, ...additionalMatches, ...impliedByExperience]);
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
    experienceLevel,
    rationale,
    redFlags,
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
    experienceLevel,
    redFlags,
    candidateId: record.id,
    ...(claudeWarning ? { warning: claudeWarning } : {}),
  };
}

export async function handleGenerateMessage(candidateId: string): Promise<GenerateMessageResult> {
  const candidate = await getCandidate(candidateId);
  if (!candidate) return { message: '', error: 'Candidato no encontrado' };

  if (candidate.tier === 'rejected') return { message: '', error: 'No se generan mensajes para candidatos descartados' };

  const apiKey = await getAnthropicApiKey();
  if (!apiKey) return { message: '', error: 'No hay clave API de Anthropic — configúrala en Ajustes' };

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
  if (!candidate) return { saved: false, error: 'Candidato no encontrado' };

  candidate.messageSentText = messageText;
  candidate.messageSentAt = new Date().toISOString();
  await saveCandidate(candidate);

  await refreshBadge(); // SCHED-03: badge decrements when candidate is marked as contacted

  return { saved: true };
}

export async function handleSavePhone(candidateId: string, phoneNumber: string): Promise<SavePhoneResult> {
  const candidate = await getCandidate(candidateId);
  if (!candidate) return { saved: false, error: 'Candidato no encontrado' };

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
    title: 'Seguimiento L3 pendiente',
    message: `Es momento de contactar a ${candidate.name} — han pasado los 7 días de espera.`,
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
