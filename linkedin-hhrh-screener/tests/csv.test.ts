import { describe, it, expect } from 'vitest';
import { candidatesToCsv } from '../src/shared/csv';
import type { CandidateRecord } from '../src/storage/schema';

function makeCandidate(overrides: Partial<CandidateRecord> = {}): CandidateRecord {
  return {
    id: 'c-001',
    name: 'Jane Smith',
    profileUrl: 'https://www.linkedin.com/in/janesmith',
    linkedinHeadline: 'Senior Engineer',
    score: 85,
    tier: 'L1',
    matchedSkills: ['TypeScript', 'React'],
    missingSkills: ['Go'],
    outreachMessage: 'Hi Jane...',
    evaluatedAt: '2026-03-10T12:00:00.000Z',
    jdId: 'jd-001',
    expiresAt: '2026-06-08T12:00:00.000Z',
    ...overrides,
  };
}

describe('candidatesToCsv', () => {
  it('produces correct header row', () => {
    const csv = candidatesToCsv([]);
    const header = csv.split('\n')[0];
    expect(header).toBe(
      'Name,Phone Number,Title,LinkedIn URL,Tier,Match Score (%),Matched Skills,Missing Skills,Evaluation Date,Contact After,Outreach Message Sent',
    );
  });

  it('includes candidate data in row', () => {
    const csv = candidatesToCsv([makeCandidate()]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Jane Smith');
    expect(lines[1]).toContain('Layer 1');
    expect(lines[1]).toContain('85');
    expect(lines[1]).toContain('2026-03-10');
  });

  it('includes Contact After date for L3 candidates', () => {
    const csv = candidatesToCsv([
      makeCandidate({
        tier: 'L3',
        score: 65,
        contactAfter: '2026-03-17T12:00:00.000Z',
      }),
    ]);
    const row = csv.split('\n')[1];
    expect(row).toContain('2026-03-17');
    expect(row).toContain('Layer 3');
  });

  it('leaves Contact After empty for non-L3 candidates', () => {
    const csv = candidatesToCsv([makeCandidate({ tier: 'L1' })]);
    const row = csv.split('\n')[1];
    const fields = row.split(',');
    // Column index 9 is Contact After (shifted +1 by Phone Number column)
    expect(fields[9]).toBe('');
  });

  it('Outreach Message Sent is empty when messageSentText is undefined', () => {
    const csv = candidatesToCsv([makeCandidate()]);
    const fields = csv.split('\n')[1].split(',');
    // Column index 10 is Outreach Message Sent (shifted +1 by Phone Number column)
    expect(fields[10]).toBe('');
  });

  it('includes sent message text', () => {
    const csv = candidatesToCsv([
      makeCandidate({ messageSentText: 'Hello from recruiter' }),
    ]);
    const row = csv.split('\n')[1];
    expect(row).toContain('Hello from recruiter');
  });

  it('escapes fields containing commas', () => {
    const csv = candidatesToCsv([
      makeCandidate({ name: 'Smith, Jane' }),
    ]);
    const row = csv.split('\n')[1];
    expect(row).toContain('"Smith, Jane"');
  });

  it('escapes fields containing double quotes', () => {
    const csv = candidatesToCsv([
      makeCandidate({ messageSentText: 'She said "hello"' }),
    ]);
    const row = csv.split('\n')[1];
    expect(row).toContain('"She said ""hello"""');
  });

  it('joins matched/missing skills with semicolons', () => {
    const csv = candidatesToCsv([
      makeCandidate({ matchedSkills: ['A', 'B', 'C'], missingSkills: ['X', 'Y'] }),
    ]);
    const row = csv.split('\n')[1];
    expect(row).toContain('A; B; C');
    expect(row).toContain('X; Y');
  });

  it('handles multiple candidates', () => {
    const csv = candidatesToCsv([
      makeCandidate({ id: '1', name: 'Alice' }),
      makeCandidate({ id: '2', name: 'Bob' }),
    ]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
  });
});
