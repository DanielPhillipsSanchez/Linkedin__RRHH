import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { fakeBrowser } from '@webext-core/fake-browser';
import {
  saveApiKey,
  getApiKey,
  saveJd,
  getAllJds,
  deleteJd,
  setActiveJdId,
  getActiveJdId,
  getStorageUsageBytes,
  STORAGE_QUOTA_BYTES,
  saveCandidate,
  getAllCandidates,
  deleteCandidate,
} from '../src/storage/storage';
import type { JobDescription, CandidateRecord } from '../src/storage/schema';

beforeEach(() => fakeBrowser.reset());
afterEach(() => fakeBrowser.reset());

function makeJd(overrides: Partial<JobDescription> = {}): JobDescription {
  return {
    id: 'test-jd-id',
    title: 'Senior Backend Engineer',
    rawText: 'We are looking for a senior backend engineer...',
    skills: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('saveApiKey', () => {
  it('writes api key to storage', async () => {
    await saveApiKey('sk-ant-test-key');
    const key = await getApiKey();
    expect(key).toBe('sk-ant-test-key');
  });

  it('overwrites existing key', async () => {
    await saveApiKey('sk-ant-first-key');
    await saveApiKey('sk-ant-second-key');
    const key = await getApiKey();
    expect(key).toBe('sk-ant-second-key');
  });
});

describe('saveJd', () => {
  it('saves JD and adds id to index', async () => {
    const jd = makeJd({ id: 'jd-001' });
    await saveJd(jd);
    const jds = await getAllJds();
    expect(jds).toHaveLength(1);
    expect(jds[0].id).toBe('jd-001');
  });

  it('saveJd rawText: preserves pasted text in rawText field', async () => {
    const rawText = 'Requirements: 5+ years Node.js, TypeScript, PostgreSQL...';
    const jd = makeJd({ id: 'jd-rawtext', rawText });
    await saveJd(jd);
    const jds = await getAllJds();
    expect(jds[0].rawText).toBe(rawText);
  });

  it('does not duplicate index entry on re-save', async () => {
    const jd = makeJd({ id: 'jd-dedup' });
    await saveJd(jd);
    await saveJd({ ...jd, title: 'Updated Title' });
    const jds = await getAllJds();
    expect(jds).toHaveLength(1);
    expect(jds[0].title).toBe('Updated Title');
  });
});

describe('getAllJds', () => {
  it('returns empty array when no JDs saved', async () => {
    const jds = await getAllJds();
    expect(jds).toEqual([]);
  });

  it('returns all saved JDs in index order', async () => {
    const jd1 = makeJd({ id: 'jd-first', title: 'First JD' });
    const jd2 = makeJd({ id: 'jd-second', title: 'Second JD' });
    await saveJd(jd1);
    await saveJd(jd2);
    const jds = await getAllJds();
    expect(jds).toHaveLength(2);
    expect(jds[0].id).toBe('jd-first');
    expect(jds[1].id).toBe('jd-second');
  });
});

describe('skill weight', () => {
  it('persists mandatory skill weight', async () => {
    const jd = makeJd({
      id: 'jd-mandatory',
      skills: [{ text: 'TypeScript', weight: 'mandatory' }],
    });
    await saveJd(jd);
    const jds = await getAllJds();
    expect(jds[0].skills[0].weight).toBe('mandatory');
  });

  it('persists nice-to-have skill weight', async () => {
    const jd = makeJd({
      id: 'jd-nicetohave',
      skills: [{ text: 'GraphQL', weight: 'nice-to-have' }],
    });
    await saveJd(jd);
    const jds = await getAllJds();
    expect(jds[0].skills[0].weight).toBe('nice-to-have');
  });
});

describe('activeJdId', () => {
  it('setActiveJdId persists and getActiveJdId retrieves', async () => {
    await setActiveJdId('jd-active-001');
    const activeId = await getActiveJdId();
    expect(activeId).toBe('jd-active-001');
  });

  it('returns undefined when no active JD set', async () => {
    const activeId = await getActiveJdId();
    expect(activeId).toBeUndefined();
  });
});

describe('deleteJd clears active', () => {
  it('deleteJd removes JD from index and storage', async () => {
    const jd = makeJd({ id: 'jd-to-delete' });
    await saveJd(jd);
    await deleteJd('jd-to-delete');
    const jds = await getAllJds();
    expect(jds).toHaveLength(0);
  });

  it('deleteJd clears activeJdId when deleted JD was active', async () => {
    const jd = makeJd({ id: 'jd-active-delete' });
    await saveJd(jd);
    await setActiveJdId('jd-active-delete');
    await deleteJd('jd-active-delete');
    const activeId = await getActiveJdId();
    expect(activeId).toBeUndefined();
  });

  it('deleteJd does not clear activeJdId when a different JD is deleted', async () => {
    const jd1 = makeJd({ id: 'jd-keep-active' });
    const jd2 = makeJd({ id: 'jd-to-remove' });
    await saveJd(jd1);
    await saveJd(jd2);
    await setActiveJdId('jd-keep-active');
    await deleteJd('jd-to-remove');
    const activeId = await getActiveJdId();
    expect(activeId).toBe('jd-keep-active');
  });
});

describe('getStorageUsageBytes', () => {
  it('returns a number', async () => {
    const bytes = await getStorageUsageBytes();
    expect(typeof bytes).toBe('number');
  });
});

describe('STORAGE_QUOTA_BYTES', () => {
  it('is 10MB (10 * 1024 * 1024)', () => {
    expect(STORAGE_QUOTA_BYTES).toBe(10 * 1024 * 1024);
  });
});

// ---- Candidate CRUD ----

function makeCandidate(overrides: Partial<CandidateRecord> = {}): CandidateRecord {
  return {
    id: 'cand-001',
    name: 'Jane Smith',
    profileUrl: 'https://linkedin.com/in/janesmith',
    linkedinHeadline: 'Senior Engineer',
    score: 85,
    tier: 'L1',
    matchedSkills: ['TypeScript', 'React'],
    missingSkills: [],
    outreachMessage: '',
    evaluatedAt: new Date().toISOString(),
    jdId: 'jd-001',
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

describe('saveCandidate', () => {
  it('saves candidate and adds id to index', async () => {
    const candidate = makeCandidate({ id: 'cand-001' });
    await saveCandidate(candidate);
    const candidates = await getAllCandidates();
    expect(candidates).toHaveLength(1);
    expect(candidates[0].id).toBe('cand-001');
    expect(candidates[0].name).toBe('Jane Smith');
    expect(candidates[0].score).toBe(85);
    expect(candidates[0].tier).toBe('L1');
  });

  it('does not duplicate index entry on re-save (updates record)', async () => {
    const candidate = makeCandidate({ id: 'cand-dedup' });
    await saveCandidate(candidate);
    await saveCandidate({ ...candidate, score: 90, tier: 'L2' });
    const candidates = await getAllCandidates();
    expect(candidates).toHaveLength(1);
    expect(candidates[0].score).toBe(90);
    expect(candidates[0].tier).toBe('L2');
  });
});

describe('getAllCandidates', () => {
  it('returns empty array when no candidates stored', async () => {
    const candidates = await getAllCandidates();
    expect(candidates).toEqual([]);
  });

  it('returns all saved candidates', async () => {
    const c1 = makeCandidate({ id: 'cand-a', name: 'Alice' });
    const c2 = makeCandidate({ id: 'cand-b', name: 'Bob' });
    const c3 = makeCandidate({ id: 'cand-c', name: 'Carol' });
    await saveCandidate(c1);
    await saveCandidate(c2);
    await saveCandidate(c3);
    const candidates = await getAllCandidates();
    expect(candidates).toHaveLength(3);
    const ids = candidates.map((c) => c.id);
    expect(ids).toContain('cand-a');
    expect(ids).toContain('cand-b');
    expect(ids).toContain('cand-c');
  });

  it('returns candidates sorted newest first by evaluatedAt', async () => {
    const older = makeCandidate({
      id: 'cand-older',
      name: 'Older',
      evaluatedAt: '2026-01-01T10:00:00.000Z',
    });
    const newer = makeCandidate({
      id: 'cand-newer',
      name: 'Newer',
      evaluatedAt: '2026-03-01T10:00:00.000Z',
    });
    await saveCandidate(older);
    await saveCandidate(newer);
    const candidates = await getAllCandidates();
    expect(candidates[0].id).toBe('cand-newer');
    expect(candidates[1].id).toBe('cand-older');
  });
});

describe('deleteCandidate', () => {
  it('removes candidate from index and storage', async () => {
    const c1 = makeCandidate({ id: 'cand-keep' });
    const c2 = makeCandidate({ id: 'cand-remove' });
    await saveCandidate(c1);
    await saveCandidate(c2);
    await deleteCandidate('cand-remove');
    const candidates = await getAllCandidates();
    expect(candidates).toHaveLength(1);
    expect(candidates[0].id).toBe('cand-keep');
  });

  it('does not throw when deleting a nonexistent id', async () => {
    await expect(deleteCandidate('nonexistent-id')).resolves.toBeUndefined();
  });
});
