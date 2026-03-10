import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { fakeBrowser } from '@webext-core/fake-browser';
import {
  validateStoredCredentials,
  handleEvaluate,
  handleGenerateMessage,
  handleSaveMessage,
  _setLastParsedProfileForTest,
} from '../entrypoints/background';
import type { CandidateProfile, ExtractionHealth } from '../src/parser/types';
import type { CandidateRecord, JobDescription } from '../src/storage/schema';
import { saveJd, setActiveJdId, getAllCandidates, saveCandidate, getCandidate, saveSnowflakeCredentials } from '../src/storage/storage';

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

const mockCreds = {
  accountUrl: 'https://test.snowflakecomputing.com',
  patToken: 'test-pat-token',
  warehouse: 'COMPUTE_WH',
};

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

// Helper for Snowflake SQL API response
function sfResponse(text: string) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({
      code: '090001',
      data: [[text]],
      resultSetMetaData: { numRows: 1 },
    }),
  };
}

describe('validateStoredCredentials', () => {
  it('returns invalid when no credentials are stored', async () => {
    const result = await validateStoredCredentials();
    expect(result).toEqual({ valid: false, error: 'No Snowflake credentials stored' });
  });

  it('returns valid result when Snowflake responds with 200', async () => {
    await saveSnowflakeCredentials(mockCreds);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await validateStoredCredentials();
    expect(result).toEqual({ valid: true });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://test.snowflakecomputing.com/api/v2/statements',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-pat-token',
          'X-Snowflake-Authorization-Token-Type': 'PROGRAMMATIC_ACCESS_TOKEN',
        }),
      }),
    );
  });

  it('returns invalid with error when fetch returns 401', async () => {
    await saveSnowflakeCredentials(mockCreds);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await validateStoredCredentials();
    expect(result).toEqual({ valid: false, error: 'Authentication failed — check your PAT token' });
  });

  it('returns invalid with network error when fetch throws', async () => {
    await saveSnowflakeCredentials(mockCreds);

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

  it('returns error when no Snowflake credentials are stored', async () => {
    _setLastParsedProfileForTest({ profile: mockProfile, health: mockHealth });

    const result = await handleEvaluate();
    expect(result.error).toMatch(/No Snowflake credentials/);
  });

  it('returns error when no active JD is set', async () => {
    _setLastParsedProfileForTest({ profile: mockProfile, health: mockHealth });
    await saveSnowflakeCredentials(mockCreds);

    const result = await handleEvaluate();
    expect(result.error).toMatch(/No active JD/);
  });

  it('returns error when active JD id does not match any stored JD', async () => {
    _setLastParsedProfileForTest({ profile: mockProfile, health: mockHealth });
    await saveSnowflakeCredentials(mockCreds);
    await setActiveJdId('nonexistent-jd-id');

    const result = await handleEvaluate();
    expect(result.error).toMatch(/Active JD not found/);
  });

  it('returns error when active JD has no skills', async () => {
    _setLastParsedProfileForTest({ profile: mockProfile, health: mockHealth });
    await saveSnowflakeCredentials(mockCreds);

    const emptySkillsJd: JobDescription = { ...mockJd, id: 'empty-jd', skills: [] };
    await saveJd(emptySkillsJd);
    await setActiveJdId('empty-jd');

    const result = await handleEvaluate();
    expect(result.error).toMatch(/Active JD has no skills/);
  });

  it('happy path: returns score, tier, matched/missing skills, rationale and saves candidate', async () => {
    _setLastParsedProfileForTest({ profile: mockProfile, health: mockHealth });
    await saveSnowflakeCredentials(mockCreds);
    await saveJd(mockJd);
    await setActiveJdId('test-jd-id');

    // Mock Cortex response — returns no additional matches for Vue (unmatched)
    const cortexJson = '{"additionalMatches": [], "rationale": "Good React and TypeScript match."}';
    const mockFetch = vi.fn().mockResolvedValue(sfResponse(cortexJson));
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
    await saveSnowflakeCredentials(mockCreds);
    await saveJd(l3Jd);
    await setActiveJdId('l3-jd-id');

    const cortexJson = '{"additionalMatches": [], "rationale": "Partial Vue match."}';
    const mockFetch = vi.fn().mockResolvedValue(sfResponse(cortexJson));
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
    await saveSnowflakeCredentials(mockCreds);
    await saveJd(mockJd);
    await setActiveJdId('test-jd-id');

    const cortexJson = '{"additionalMatches": [], "rationale": "Great match."}';
    const mockFetch = vi.fn().mockResolvedValue(sfResponse(cortexJson));
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

  it('returns error when no Snowflake credentials are stored', async () => {
    const candidate = baseCandidateRecord();
    await saveCandidate(candidate);

    const result = await handleGenerateMessage(candidate.id);
    expect(result.message).toBe('');
    expect(result.error).toContain('No Snowflake credentials');
  });

  it('happy path: returns message from Cortex and updates candidate outreachMessage in storage', async () => {
    const candidate = baseCandidateRecord();
    await saveCandidate(candidate);
    await saveSnowflakeCredentials(mockCreds);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sfResponse('Hello Jane')));

    const result = await handleGenerateMessage(candidate.id);

    expect(result.message).toBe('Hello Jane');
    expect(result.error).toBeUndefined();

    const stored = await getCandidate(candidate.id);
    expect(stored?.outreachMessage).toBe('Hello Jane');
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
