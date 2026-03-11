import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { fakeBrowser } from '@webext-core/fake-browser';
import {
  validateStoredCredentials,
  handleEvaluate,
  handleGenerateMessage,
  handleSaveMessage,
  refreshBadge,
  _setLastParsedProfileForTest,
} from '../entrypoints/background';
import type { CandidateProfile, ExtractionHealth } from '../src/parser/types';
import type { CandidateRecord, JobDescription } from '../src/storage/schema';
import { saveJd, setActiveJdId, getAllCandidates, saveCandidate, getCandidate, saveAnthropicApiKey } from '../src/storage/storage';

beforeEach(() => {
  fakeBrowser.reset();
  vi.unstubAllGlobals();
  // Reset in-memory profile state between tests
  _setLastParsedProfileForTest(null);
});

afterEach(() => {
  fakeBrowser.reset();
  vi.unstubAllGlobals();
  _setLastParsedProfileForTest(null);
});

// --- Test fixtures ---

const MOCK_API_KEY = 'sk-ant-test-key';

const mockProfile: CandidateProfile = {
  name: 'Jane Doe',
  headline: 'Senior Frontend Engineer',
  about: 'Experienced engineer with React and TypeScript expertise.',
  skills: ['React', 'TypeScript', 'Node.js'],
  experience: [{ title: 'Senior Frontend Engineer', company: 'Acme Corp', duration: '2020–present' }],
  education: [{ institution: 'MIT', degree: 'B.Sc Computer Science', duration: '2014–2018' }],
  profileUrl: 'https://linkedin.com/in/janedoe',
};

const mockHealth: ExtractionHealth = {
  ok: true,
  missing: [],
};

const mockJd: JobDescription = {
  id: 'test-jd-id',
  title: 'Frontend Engineer',
  rawText: 'Looking for a React developer.',
  skills: [
    { text: 'React', weight: 'mandatory' },
    { text: 'TypeScript', weight: 'mandatory' },
    { text: 'Vue', weight: 'nice-to-have' },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

// Helper for Anthropic Messages API response
function anthropicResponse(text: string) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ content: [{ type: 'text', text }] }),
  };
}

describe('validateStoredCredentials', () => {
  it('returns invalid when no credentials are stored', async () => {
    const result = await validateStoredCredentials();
    expect(result).toEqual({ valid: false, error: 'No Anthropic API key stored' });
  });

  it('returns valid result when Anthropic responds with 200', async () => {
    await saveAnthropicApiKey(MOCK_API_KEY);

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', mockFetch);

    const result = await validateStoredCredentials();
    expect(result).toEqual({ valid: true });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns invalid with error when fetch returns 401', async () => {
    await saveAnthropicApiKey(MOCK_API_KEY);

    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 401 });
    vi.stubGlobal('fetch', mockFetch);

    const result = await validateStoredCredentials();
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid API key');
  });

  it('returns invalid with network error when fetch throws', async () => {
    await saveAnthropicApiKey(MOCK_API_KEY);

    const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', mockFetch);

    const result = await validateStoredCredentials();
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Network error');
  });
});

describe('handleEvaluate', () => {
  it('returns error when no profile is loaded', async () => {
    const result = await handleEvaluate();
    expect(result.error).toMatch(/No profile data/);
  });

  it('returns error when no Anthropic API key is stored', async () => {
    _setLastParsedProfileForTest({ profile: mockProfile, health: mockHealth });

    const result = await handleEvaluate();
    expect(result.error).toMatch(/No Anthropic API key/);
  });

  it('returns error when no active JD is set', async () => {
    _setLastParsedProfileForTest({ profile: mockProfile, health: mockHealth });
    await saveAnthropicApiKey(MOCK_API_KEY);

    const result = await handleEvaluate();
    expect(result.error).toMatch(/No active JD/);
  });

  it('returns error when active JD id does not match any stored JD', async () => {
    _setLastParsedProfileForTest({ profile: mockProfile, health: mockHealth });
    await saveAnthropicApiKey(MOCK_API_KEY);
    await setActiveJdId('nonexistent-jd-id');

    const result = await handleEvaluate();
    expect(result.error).toMatch(/Active JD not found/);
  });

  it('returns error when active JD has no skills', async () => {
    _setLastParsedProfileForTest({ profile: mockProfile, health: mockHealth });
    await saveAnthropicApiKey(MOCK_API_KEY);

    const emptySkillsJd: JobDescription = { ...mockJd, id: 'empty-jd', skills: [] };
    await saveJd(emptySkillsJd);
    await setActiveJdId('empty-jd');

    const result = await handleEvaluate();
    expect(result.error).toMatch(/Active JD has no skills/);
  });

  it('happy path: returns score, tier, matched/missing skills, rationale and saves candidate', async () => {
    _setLastParsedProfileForTest({ profile: mockProfile, health: mockHealth });
    await saveAnthropicApiKey(MOCK_API_KEY);
    await saveJd(mockJd);
    await setActiveJdId('test-jd-id');

    // Mock Anthropic response — returns no additional matches for Vue (unmatched)
    const claudeJson = '{"additionalMatches": [], "rationale": "Good React and TypeScript match."}';
    const mockFetch = vi.fn().mockResolvedValue(anthropicResponse(claudeJson));
    vi.stubGlobal('fetch', mockFetch);

    const result = await handleEvaluate();

    expect(result.error).toBeUndefined();
    // Score: React (mandatory, matched=2) + TypeScript (mandatory, matched=2) + Vue (nice-to-have, unmatched=1)
    // totalPoints = 2+2+1 = 5, matchedPoints = 2+2 = 4, score = round(4/5*100) = 80
    expect(result.score).toBe(80);
    expect(result.tier).toBe('L1');
    expect(result.tierLabel).toBe('Layer 1');
    expect(result.matchedSkills).toContain('React');
    expect(result.matchedSkills).toContain('TypeScript');
    expect(result.missingSkills).toEqual([]);
    expect(result.rationale).toBe('Good React and TypeScript match.');
    expect(result.candidateId).toBeTruthy();

    const candidates = await getAllCandidates();
    expect(candidates).toHaveLength(1);
    expect(candidates[0].name).toBe('Jane Doe');
    expect(candidates[0].score).toBe(80);
    expect(candidates[0].jdId).toBe('test-jd-id');
    expect(candidates[0].outreachMessage).toBe('');
    expect(candidates[0].expiresAt).toBeTruthy();
  });

  it('L3 candidate gets contactAfter set to evaluatedAt + 7 days', async () => {
    const l3Jd: JobDescription = {
      id: 'l3-jd-id',
      title: 'Frontend Engineer L3',
      rawText: 'React TypeScript Vue all required',
      skills: [
        { text: 'React', weight: 'mandatory' },
        { text: 'TypeScript', weight: 'mandatory' },
        { text: 'Vue', weight: 'mandatory' },
      ],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    _setLastParsedProfileForTest({ profile: mockProfile, health: mockHealth });
    await saveAnthropicApiKey(MOCK_API_KEY);
    await saveJd(l3Jd);
    await setActiveJdId('l3-jd-id');

    const claudeJson = '{"additionalMatches": [], "rationale": "Partial Vue match."}';
    const mockFetch = vi.fn().mockResolvedValue(anthropicResponse(claudeJson));
    vi.stubGlobal('fetch', mockFetch);

    const result = await handleEvaluate();

    expect(result.error).toBeUndefined();
    expect(result.score).toBe(67);
    expect(result.tier).toBe('L3');

    const candidates = await getAllCandidates();
    expect(candidates).toHaveLength(1);
    const candidate = candidates[0];

    expect(candidate.contactAfter).toBeTruthy();
    const evaluatedAt = new Date(candidate.evaluatedAt).getTime();
    const contactAfter = new Date(candidate.contactAfter!).getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(contactAfter - evaluatedAt).toBeCloseTo(sevenDaysMs, -3);
  });

  it('non-L3 candidate does not have contactAfter', async () => {
    _setLastParsedProfileForTest({ profile: mockProfile, health: mockHealth });
    await saveAnthropicApiKey(MOCK_API_KEY);
    await saveJd(mockJd);
    await setActiveJdId('test-jd-id');

    const claudeJson = '{"additionalMatches": [], "rationale": "Great match."}';
    const mockFetch = vi.fn().mockResolvedValue(anthropicResponse(claudeJson));
    vi.stubGlobal('fetch', mockFetch);

    const result = await handleEvaluate();
    expect(result.tier).toBe('L1');

    const candidates = await getAllCandidates();
    expect(candidates[0].contactAfter).toBeUndefined();
  });
});

// --- Fixture helper for handleGenerateMessage and handleSaveMessage ---

const baseCandidateRecord = (): CandidateRecord => ({
  id: crypto.randomUUID(),
  name: 'Test Candidate',
  profileUrl: 'https://linkedin.com/in/test',
  linkedinHeadline: 'Engineer',
  score: 80,
  tier: 'L1',
  matchedSkills: ['React'],
  missingSkills: [],
  outreachMessage: '',
  evaluatedAt: new Date().toISOString(),
  jdId: 'test-jd-id',
  expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
});

describe('handleGenerateMessage', () => {
  it('returns error when candidateId is not in storage', async () => {
    const result = await handleGenerateMessage('nonexistent-id');
    expect(result.message).toBe('');
    expect(result.error).toBe('Candidate not found');
  });

  it('returns error when candidate tier is rejected', async () => {
    const candidate = { ...baseCandidateRecord(), tier: 'rejected' as const };
    await saveCandidate(candidate);

    const result = await handleGenerateMessage(candidate.id);
    expect(result.message).toBe('');
    expect(result.error).toBe('No outreach message for rejected candidates');
  });

  it('returns error when no Anthropic API key is stored', async () => {
    const candidate = baseCandidateRecord();
    await saveCandidate(candidate);

    const result = await handleGenerateMessage(candidate.id);
    expect(result.message).toBe('');
    expect(result.error).toContain('No Anthropic API key');
  });

  it('happy path: returns message from Claude and updates candidate outreachMessage in storage', async () => {
    const candidate = baseCandidateRecord();
    await saveCandidate(candidate);
    await saveAnthropicApiKey(MOCK_API_KEY);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(anthropicResponse('Hello Test Candidate')));

    const result = await handleGenerateMessage(candidate.id);

    expect(result.message).toBe('Hello Test Candidate');
    expect(result.error).toBeUndefined();

    const stored = await getCandidate(candidate.id);
    expect(stored?.outreachMessage).toBe('Hello Test Candidate');
  });
});

describe('handleSaveMessage', () => {
  it('returns error when candidateId is not in storage', async () => {
    const result = await handleSaveMessage('nonexistent-id', 'Hello');
    expect(result.saved).toBe(false);
    expect(result.error).toBe('Candidate not found');
  });

  it('happy path: writes messageSentText and messageSentAt to candidate record', async () => {
    const candidate = baseCandidateRecord();
    await saveCandidate(candidate);

    const result = await handleSaveMessage(candidate.id, 'Hello Test Candidate');

    expect(result.saved).toBe(true);
    expect(result.error).toBeUndefined();

    const stored = await getCandidate(candidate.id);
    expect(stored?.messageSentText).toBe('Hello Test Candidate');
    expect(stored?.messageSentAt).toBeTruthy();
    // Verify it looks like an ISO 8601 string
    expect(new Date(stored!.messageSentAt!).toISOString()).toBe(stored!.messageSentAt);
  });
});

// --- L3 JD fixture: React + TypeScript + Vue all mandatory → score 67% → L3 tier ---
const mockL3Jd: JobDescription = {
  id: 'l3-sched-jd-id',
  title: 'Frontend Engineer L3 Sched',
  rawText: 'React TypeScript Vue all required',
  skills: [
    { text: 'React', weight: 'mandatory' },
    { text: 'TypeScript', weight: 'mandatory' },
    { text: 'Vue', weight: 'mandatory' },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('SCHED-01: L3 alarm creation', () => {
  let setBadgeTextSpy: ReturnType<typeof vi.spyOn>;
  let setBadgeColorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setBadgeTextSpy = vi.spyOn(browser.action, 'setBadgeText').mockResolvedValue(undefined);
    setBadgeColorSpy = vi.spyOn(browser.action, 'setBadgeBackgroundColor').mockResolvedValue(undefined);
  });

  it('evaluating an L3 candidate creates an alarm named l3-followup-{id} scheduled at contactAfter', async () => {
    _setLastParsedProfileForTest({ profile: mockProfile, health: mockHealth });
    await saveAnthropicApiKey(MOCK_API_KEY);
    await saveJd(mockL3Jd);
    await setActiveJdId('l3-sched-jd-id');

    // Claude returns no additional matches — Vue is unmatched → score 67% → L3
    const claudeJson = '{"additionalMatches": [], "rationale": "Vue not matched."}';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(anthropicResponse(claudeJson)));

    const result = await handleEvaluate();

    expect(result.error).toBeUndefined();
    expect(result.tier).toBe('L3');

    const allAlarms = await browser.alarms.getAll();
    const alarm = allAlarms.find((a) => a.name === `l3-followup-${result.candidateId}`);
    expect(alarm).toBeDefined();

    // Alarm's scheduledTime should equal contactAfter in milliseconds
    const candidates = await getAllCandidates();
    const candidate = candidates.find((c) => c.id === result.candidateId);
    expect(candidate?.contactAfter).toBeDefined();
    expect(alarm!.scheduledTime).toBe(new Date(candidate!.contactAfter!).getTime());
  });

  it('evaluating a non-L3 candidate (L1) does NOT create any alarm', async () => {
    _setLastParsedProfileForTest({ profile: mockProfile, health: mockHealth });
    await saveAnthropicApiKey(MOCK_API_KEY);
    await saveJd(mockJd); // L1 JD: React+TypeScript mandatory, Vue nice-to-have → score 80% → L1
    await setActiveJdId('test-jd-id');

    const claudeJson = '{"additionalMatches": [], "rationale": "Great match."}';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(anthropicResponse(claudeJson)));

    const result = await handleEvaluate();

    expect(result.tier).toBe('L1');

    const allAlarms = await browser.alarms.getAll();
    expect(allAlarms).toHaveLength(0);
  });

  it('re-evaluating the same profile when already L3 calls alarms.create again (idempotent)', async () => {
    _setLastParsedProfileForTest({ profile: mockProfile, health: mockHealth });
    await saveAnthropicApiKey(MOCK_API_KEY);
    await saveJd(mockL3Jd);
    await setActiveJdId('l3-sched-jd-id');

    const claudeJson = '{"additionalMatches": [], "rationale": "Vue not matched."}';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(anthropicResponse(claudeJson)));

    await handleEvaluate();
    await handleEvaluate();

    // Two evaluations → two alarms (different candidateIds since each evaluation is a new record)
    const allAlarms = await browser.alarms.getAll();
    expect(allAlarms.length).toBeGreaterThanOrEqual(1);
    // Confirm all alarm names start with l3-followup-
    expect(allAlarms.every((a) => a.name.startsWith('l3-followup-'))).toBe(true);
  });
});

describe('SCHED-02: alarm fire notification', () => {
  let setBadgeTextSpy: ReturnType<typeof vi.spyOn>;
  let setBadgeColorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setBadgeTextSpy = vi.spyOn(browser.action, 'setBadgeText').mockResolvedValue(undefined);
    setBadgeColorSpy = vi.spyOn(browser.action, 'setBadgeBackgroundColor').mockResolvedValue(undefined);
  });

  it('firing the alarm for an L3 candidate creates a notification naming the candidate', async () => {
    const candidate: CandidateRecord = {
      ...baseCandidateRecord(),
      id: 'sched-candidate-01',
      name: 'Alice Smith',
      tier: 'L3',
      contactAfter: new Date(Date.now() - 1000).toISOString(), // already overdue
    };
    await saveCandidate(candidate);

    await fakeBrowser.alarms.onAlarm.trigger({
      name: `l3-followup-${candidate.id}`,
      scheduledTime: Date.now(),
    });

    const notifs = await browser.notifications.getAll();
    expect(notifs[`notif-${candidate.id}`]).toBeDefined();
    expect(notifs[`notif-${candidate.id}`].message).toContain('Alice Smith');
  });

  it('firing the alarm for a candidate whose messageSentAt is set does NOT create a notification', async () => {
    const candidate: CandidateRecord = {
      ...baseCandidateRecord(),
      id: 'sched-candidate-02',
      name: 'Bob Jones',
      tier: 'L3',
      contactAfter: new Date(Date.now() - 1000).toISOString(),
      messageSentAt: new Date().toISOString(),
    };
    await saveCandidate(candidate);

    await fakeBrowser.alarms.onAlarm.trigger({
      name: `l3-followup-${candidate.id}`,
      scheduledTime: Date.now(),
    });

    const notifs = await browser.notifications.getAll();
    expect(notifs[`notif-${candidate.id}`]).toBeUndefined();
  });

  it('firing an alarm with an unrecognized name does nothing', async () => {
    await fakeBrowser.alarms.onAlarm.trigger({
      name: 'unrecognized-alarm',
      scheduledTime: Date.now(),
    });

    const notifs = await browser.notifications.getAll();
    expect(Object.keys(notifs)).toHaveLength(0);
  });
});

describe('SCHED-03: badge refresh logic', () => {
  let setBadgeTextSpy: ReturnType<typeof vi.spyOn>;
  let setBadgeColorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setBadgeTextSpy = vi.spyOn(browser.action, 'setBadgeText').mockResolvedValue(undefined);
    setBadgeColorSpy = vi.spyOn(browser.action, 'setBadgeBackgroundColor').mockResolvedValue(undefined);
  });

  it('refreshBadge() with one overdue uncontacted L3 candidate calls setBadgeText with "1"', async () => {
    const candidate: CandidateRecord = {
      ...baseCandidateRecord(),
      id: 'badge-candidate-01',
      tier: 'L3',
      contactAfter: new Date(Date.now() - 1000).toISOString(), // overdue
    };
    await saveCandidate(candidate);

    await refreshBadge();

    expect(setBadgeTextSpy).toHaveBeenCalledWith({ text: '1' });
    expect(setBadgeColorSpy).toHaveBeenCalledWith({ color: '#E53935' });
  });

  it('refreshBadge() with zero overdue L3s calls setBadgeText with empty string', async () => {
    await refreshBadge();

    expect(setBadgeTextSpy).toHaveBeenCalledWith({ text: '' });
  });

  it('refreshBadge() with an L3 whose messageSentAt is set treats them as contacted (not counted)', async () => {
    const candidate: CandidateRecord = {
      ...baseCandidateRecord(),
      id: 'badge-candidate-02',
      tier: 'L3',
      contactAfter: new Date(Date.now() - 1000).toISOString(),
      messageSentAt: new Date().toISOString(), // already contacted
    };
    await saveCandidate(candidate);

    await refreshBadge();

    expect(setBadgeTextSpy).toHaveBeenCalledWith({ text: '' });
    expect(setBadgeColorSpy).not.toHaveBeenCalled();
  });

  it('handleSaveMessage() on an L3 candidate triggers refreshBadge (setBadgeText called after save)', async () => {
    const candidate: CandidateRecord = {
      ...baseCandidateRecord(),
      id: 'badge-candidate-03',
      tier: 'L3',
      contactAfter: new Date(Date.now() - 1000).toISOString(),
    };
    await saveCandidate(candidate);

    await handleSaveMessage(candidate.id, 'Hi Alice');

    // After saving, candidate has messageSentAt → overdue count drops to 0 → badge cleared
    expect(setBadgeTextSpy).toHaveBeenCalledWith({ text: '' });
  });
});
