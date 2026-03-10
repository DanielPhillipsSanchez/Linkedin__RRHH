import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { fakeBrowser } from '@webext-core/fake-browser';
import {
  validateStoredApiKey,
  handleEvaluate,
  _setLastParsedProfileForTest,
} from '../entrypoints/background';
import type { CandidateProfile, ExtractionHealth } from '../src/parser/types';
import type { JobDescription } from '../src/storage/schema';
import { saveJd, setActiveJdId, getAllCandidates } from '../src/storage/storage';

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

describe('validateStoredApiKey', () => {
  it('returns invalid when no api key is stored', async () => {
    // No key set in storage — fakeBrowser starts empty after reset
    const result = await validateStoredApiKey();
    expect(result).toEqual({ valid: false, error: 'No API key stored' });
  });

  it('returns valid result when background fetch succeeds with 200', async () => {
    // Set up a stored API key
    await fakeBrowser.storage.local.set({ 'settings:apiKey': 'sk-ant-test-key' });

    // Mock fetch to return 200
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await validateStoredApiKey();
    expect(result).toEqual({ valid: true });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/models?limit=1',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-api-key': 'sk-ant-test-key',
          'anthropic-version': '2023-06-01',
        }),
      }),
    );
  });

  it('returns invalid with error message when fetch returns 401', async () => {
    await fakeBrowser.storage.local.set({ 'settings:apiKey': 'sk-ant-invalid-key' });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await validateStoredApiKey();
    expect(result).toEqual({ valid: false, error: 'Invalid API key' });
  });

  it('returns invalid with network error message when fetch throws', async () => {
    await fakeBrowser.storage.local.set({ 'settings:apiKey': 'sk-ant-test-key' });

    const mockFetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', mockFetch);

    const result = await validateStoredApiKey();
    expect(result).toEqual({ valid: false, error: 'Network error — check your connection' });
  });
});

describe('handleEvaluate', () => {
  it('returns error when no profile is loaded', async () => {
    // _setLastParsedProfileForTest(null) already called in beforeEach
    const result = await handleEvaluate();
    expect(result.error).toMatch(/No profile data/);
  });

  it('returns error when no API key is stored', async () => {
    _setLastParsedProfileForTest({ profile: mockProfile, health: mockHealth });

    // No API key in storage
    const result = await handleEvaluate();
    expect(result.error).toMatch(/No API key/);
  });

  it('returns error when no active JD is set', async () => {
    _setLastParsedProfileForTest({ profile: mockProfile, health: mockHealth });
    await fakeBrowser.storage.local.set({ 'settings:apiKey': 'sk-ant-test-key' });

    // No active JD in storage
    const result = await handleEvaluate();
    expect(result.error).toMatch(/No active JD/);
  });

  it('returns error when active JD id does not match any stored JD', async () => {
    _setLastParsedProfileForTest({ profile: mockProfile, health: mockHealth });
    await fakeBrowser.storage.local.set({ 'settings:apiKey': 'sk-ant-test-key' });
    await setActiveJdId('nonexistent-jd-id');

    const result = await handleEvaluate();
    expect(result.error).toMatch(/Active JD not found/);
  });

  it('returns error when active JD has no skills', async () => {
    _setLastParsedProfileForTest({ profile: mockProfile, health: mockHealth });
    await fakeBrowser.storage.local.set({ 'settings:apiKey': 'sk-ant-test-key' });

    const emptySkillsJd: JobDescription = { ...mockJd, id: 'empty-jd', skills: [] };
    await saveJd(emptySkillsJd);
    await setActiveJdId('empty-jd');

    const result = await handleEvaluate();
    expect(result.error).toMatch(/Active JD has no skills/);
  });

  it('happy path: returns score, tier, matched/missing skills, rationale and saves candidate', async () => {
    // Pre-populate: profile, API key, JD with skills, active JD
    _setLastParsedProfileForTest({ profile: mockProfile, health: mockHealth });
    await fakeBrowser.storage.local.set({ 'settings:apiKey': 'sk-ant-test-key' });
    await saveJd(mockJd);
    await setActiveJdId('test-jd-id');

    // Mock Claude API response — returns no additional matches for Vue (unmatched)
    const claudeResponse = {
      content: [{ type: 'text', text: '{"additionalMatches": [], "rationale": "Good React and TypeScript match."}' }],
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(claudeResponse),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await handleEvaluate();

    // No error
    expect(result.error).toBeUndefined();

    // Score: React (mandatory, matched=2) + TypeScript (mandatory, matched=2) + Vue (nice-to-have, unmatched=1)
    // totalPoints = 2+2+1 = 5, matchedPoints = 2+2 = 4, score = round(4/5*100) = 80
    expect(result.score).toBe(80);
    expect(result.tier).toBe('L1');
    expect(result.tierLabel).toBe('Layer 1');
    expect(result.matchedSkills).toContain('React');
    expect(result.matchedSkills).toContain('TypeScript');
    expect(result.missingSkills).toEqual([]); // no mandatory unmatched
    expect(result.rationale).toBe('Good React and TypeScript match.');
    expect(result.candidateId).toBeTruthy();

    // Verify candidate saved to storage
    const candidates = await getAllCandidates();
    expect(candidates).toHaveLength(1);
    expect(candidates[0].name).toBe('Jane Doe');
    expect(candidates[0].score).toBe(80);
    expect(candidates[0].jdId).toBe('test-jd-id');
    expect(candidates[0].outreachMessage).toBe('');
    expect(candidates[0].expiresAt).toBeTruthy();
  });

  it('L3 candidate gets contactAfter set to evaluatedAt + 7 days', async () => {
    // JD producing a score of 67 (L3 range: 60–70)
    // React(mandatory=2,matched) + TypeScript(mandatory=2,matched) + Vue(mandatory=2,NOT matched)
    // totalPoints=6, matched=4, score=round(4/6*100)=67 → L3
    const l3Jd: JobDescription = {
      id: 'l3-jd-id',
      title: 'Frontend Engineer L3',
      rawText: 'React TypeScript Vue all required',
      skills: [
        { text: 'React', weight: 'mandatory' },       // matched → 2pts
        { text: 'TypeScript', weight: 'mandatory' },  // matched → 2pts
        { text: 'Vue', weight: 'mandatory' },         // NOT matched → 2pts (total 6, matched 4, score 67)
      ],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    _setLastParsedProfileForTest({ profile: mockProfile, health: mockHealth });
    await fakeBrowser.storage.local.set({ 'settings:apiKey': 'sk-ant-test-key' });
    await saveJd(l3Jd);
    await setActiveJdId('l3-jd-id');

    // Claude returns no additional matches for Vue
    const claudeResponse = {
      content: [{ type: 'text', text: '{"additionalMatches": [], "rationale": "Partial Vue match."}' }],
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(claudeResponse),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await handleEvaluate();

    expect(result.error).toBeUndefined();
    expect(result.score).toBe(67);
    expect(result.tier).toBe('L3');

    const candidates = await getAllCandidates();
    expect(candidates).toHaveLength(1);
    const candidate = candidates[0];

    // contactAfter should be set and ~7 days after evaluatedAt
    expect(candidate.contactAfter).toBeTruthy();
    const evaluatedAt = new Date(candidate.evaluatedAt).getTime();
    const contactAfter = new Date(candidate.contactAfter!).getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(contactAfter - evaluatedAt).toBeCloseTo(sevenDaysMs, -3); // within ~1 second
  });

  it('non-L3 candidate does not have contactAfter', async () => {
    _setLastParsedProfileForTest({ profile: mockProfile, health: mockHealth });
    await fakeBrowser.storage.local.set({ 'settings:apiKey': 'sk-ant-test-key' });
    await saveJd(mockJd);
    await setActiveJdId('test-jd-id');

    const claudeResponse = {
      content: [{ type: 'text', text: '{"additionalMatches": [], "rationale": "Great match."}' }],
    };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(claudeResponse),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await handleEvaluate();
    expect(result.tier).toBe('L1'); // score 80 → L1

    const candidates = await getAllCandidates();
    expect(candidates[0].contactAfter).toBeUndefined();
  });
});
