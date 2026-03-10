import { describe, it, expect, vi, afterEach } from 'vitest';
import { skillMatches, computeScore, runKeywordPass } from '../src/scorer/scorer';
import { assignTier } from '../src/scorer/tiers';
import { refineWithClaude } from '../src/scorer/claude';
import type { Skill } from '../src/storage/schema';
import type { CandidateProfile } from '../src/parser/types';

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// SCORE-01 / SCORE-06 — keyword matching
// ---------------------------------------------------------------------------

describe('skillMatches', () => {
  it('matches when candidate skill contains JD skill (e.g. React in React.js)', () => {
    expect(skillMatches('React', ['React.js', 'Node.js'])).toBe(true);
  });

  it('returns false when no candidate skill is related', () => {
    expect(skillMatches('Python', ['JavaScript', 'TypeScript'])).toBe(false);
  });

  it('matches bidirectionally: JD skill contains candidate skill (Node.js vs Node)', () => {
    expect(skillMatches('Node.js', ['Node'])).toBe(true);
  });

  it('matches case-insensitively (machine learning vs Machine Learning Engineer)', () => {
    expect(skillMatches('machine learning', ['Machine Learning Engineer'])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SCORE-03 — weighted scoring
// ---------------------------------------------------------------------------

describe('computeScore', () => {
  it('2 mandatory (both matched) + 1 nice-to-have (unmatched) → score = 80', () => {
    const jdSkills: Skill[] = [
      { text: 'TypeScript', weight: 'mandatory' },
      { text: 'React', weight: 'mandatory' },
      { text: 'GraphQL', weight: 'nice-to-have' },
    ];
    // matchedSkillTexts uses the JD skill text strings (post-pass)
    const matched = new Set<string>(['TypeScript', 'React']);
    // total points = 2 + 2 + 1 = 5; matched points = 2 + 2 = 4 → round(4/5*100) = 80
    expect(computeScore(jdSkills, matched)).toBe(80);
  });

  it('1 mandatory (unmatched) → score = 0', () => {
    const jdSkills: Skill[] = [{ text: 'Python', weight: 'mandatory' }];
    const matched = new Set<string>();
    expect(computeScore(jdSkills, matched)).toBe(0);
  });

  it('empty skills list → score = 0', () => {
    const jdSkills: Skill[] = [];
    const matched = new Set<string>();
    expect(computeScore(jdSkills, matched)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// SCORE-04 — tier assignment
// ---------------------------------------------------------------------------

describe('assignTier', () => {
  it('score 80 → L1', () => expect(assignTier(80)).toBe('L1'));
  it('score 79 → L2', () => expect(assignTier(79)).toBe('L2'));
  it('score 71 → L2', () => expect(assignTier(71)).toBe('L2'));
  it('score 70 → L3', () => expect(assignTier(70)).toBe('L3'));
  it('score 60 → L3', () => expect(assignTier(60)).toBe('L3'));
  it('score 59 → rejected', () => expect(assignTier(59)).toBe('rejected'));
  it('score 0 → rejected', () => expect(assignTier(0)).toBe('rejected'));
});

// ---------------------------------------------------------------------------
// SCORE-06 / SCORE-07 — runKeywordPass: matchedSkills and missingSkills
// ---------------------------------------------------------------------------

describe('runKeywordPass', () => {
  it('2 of 3 JD skills matched → matchedSkills has 2 items, unmatchedSkills has 1 mandatory item', () => {
    const jdSkills: Skill[] = [
      { text: 'TypeScript', weight: 'mandatory' },
      { text: 'React', weight: 'mandatory' },
      { text: 'GraphQL', weight: 'nice-to-have' },
    ];
    const candidateSkills = ['TypeScript', 'React', 'PostgreSQL'];

    const { matchedSkills, unmatchedSkills } = runKeywordPass(jdSkills, candidateSkills);

    expect(matchedSkills).toHaveLength(2);
    expect(matchedSkills).toContain('TypeScript');
    expect(matchedSkills).toContain('React');
    // unmatchedSkills contains only the 1 unmatched skill (GraphQL, nice-to-have)
    expect(unmatchedSkills).toHaveLength(1);
    expect(unmatchedSkills[0].text).toBe('GraphQL');
  });

  it('missingSkills (mandatory unmatched) does not include nice-to-have unmatched skills', () => {
    const jdSkills: Skill[] = [
      { text: 'Python', weight: 'mandatory' },
      { text: 'Django', weight: 'nice-to-have' },
    ];
    const candidateSkills = ['JavaScript'];

    const { matchedSkills, unmatchedSkills } = runKeywordPass(jdSkills, candidateSkills);

    expect(matchedSkills).toHaveLength(0);
    // Both Python (mandatory) and Django (nice-to-have) are unmatched
    expect(unmatchedSkills).toHaveLength(2);

    // Caller filters unmatchedSkills to mandatory-only for display as "missing skills"
    const missingSkills = unmatchedSkills
      .filter((s) => s.weight === 'mandatory')
      .map((s) => s.text);
    expect(missingSkills).toEqual(['Python']);
    expect(missingSkills).not.toContain('Django');
  });
});

// ---------------------------------------------------------------------------
// SCORE-02 / SCORE-08 — Claude refinement (mocked fetch)
// ---------------------------------------------------------------------------

const mockProfile: CandidateProfile = {
  name: 'Ana García',
  headline: 'Backend Engineer at Acme',
  about: 'I have worked with Python and Django for 5 years.',
  skills: ['JavaScript', 'TypeScript'],
  experience: [{ title: 'Backend Engineer', company: 'Acme', duration: '2020–present' }],
  education: [{ institution: 'UPM', degree: 'Computer Science', duration: '2016–2020' }],
  profileUrl: 'https://www.linkedin.com/in/anagarcia',
};

const mockUnmatchedSkills: Skill[] = [{ text: 'Python', weight: 'mandatory' }];

const MOCK_API_KEY = 'sk-ant-test-key';

// Helper to build an Anthropic Messages API success response
function anthropicResponse(text: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ content: [{ type: 'text', text }] }),
  };
}

describe('refineWithClaude', () => {
  it('returns additionalMatches and rationale from a clean JSON response', async () => {
    const jsonText = JSON.stringify({
      additionalMatches: ['Python'],
      rationale: 'Candidate mentioned Python in about section.',
    });
    const mockFetch = vi.fn().mockResolvedValue(anthropicResponse(jsonText));
    vi.stubGlobal('fetch', mockFetch);

    const result = await refineWithClaude(MOCK_API_KEY, mockProfile, mockUnmatchedSkills);

    expect(result.additionalMatches).toEqual(['Python']);
    expect(result.rationale).toBe('Candidate mentioned Python in about section.');
  });

  it('parses correctly when Claude wraps response in markdown code fences', async () => {
    const text = '```json\n{"additionalMatches":["Python"],"rationale":"Inferred from about section."}\n```';
    const mockFetch = vi.fn().mockResolvedValue(anthropicResponse(text));
    vi.stubGlobal('fetch', mockFetch);

    const result = await refineWithClaude(MOCK_API_KEY, mockProfile, mockUnmatchedSkills);

    expect(result.additionalMatches).toEqual(['Python']);
    expect(result.rationale).toBe('Inferred from about section.');
  });

  it('returns empty additionalMatches and empty rationale when Claude returns malformed JSON', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      anthropicResponse('Sorry, I cannot process this request right now.'),
    );
    vi.stubGlobal('fetch', mockFetch);

    const result = await refineWithClaude(MOCK_API_KEY, mockProfile, mockUnmatchedSkills);

    expect(result.additionalMatches).toEqual([]);
    expect(result.rationale).toBe('');
  });
});
