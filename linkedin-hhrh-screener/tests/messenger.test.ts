import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateOutreachMessage } from '../src/scorer/messenger';
import type { CandidateProfile } from '../src/parser/types';
import type { CortexCredentials } from '../src/scorer/cortex';

afterEach(() => {
  vi.unstubAllGlobals();
});

const MOCK_CREDS: CortexCredentials = {
  accountUrl: 'https://test.snowflakecomputing.com',
  patToken: 'test-pat-token',
  warehouse: 'COMPUTE_WH',
};

const MOCK_PROFILE: CandidateProfile = {
  name: 'Jane Smith',
  headline: 'Senior Software Engineer at Acme',
  about: 'Passionate about building scalable systems.',
  skills: ['TypeScript', 'React', 'Node.js'],
  experience: [
    { title: 'Senior Engineer', company: 'Acme Corp', duration: '3 years' },
    { title: 'Engineer', company: 'StartupX', duration: '2 years' },
  ],
  education: [{ institution: 'MIT', degree: 'BS Computer Science', duration: '4 years' }],
  profileUrl: 'https://www.linkedin.com/in/janesmith',
};

// Snowflake SQL API success response shape
function sfResponse(text: string) {
  return {
    ok: true,
    json: async () => ({
      code: '090001',
      data: [[text]],
      resultSetMetaData: { numRows: 1 },
    }),
  };
}

describe('generateOutreachMessage', () => {
  it('returns message text on successful Cortex call', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(sfResponse('Hi Jane, I noticed your work at Acme...')),
    );

    const result = await generateOutreachMessage(
      MOCK_CREDS,
      MOCK_PROFILE,
      'L1',
      ['TypeScript', 'React'],
      ['Go'],
      'Senior Backend Engineer',
    );

    expect(result.message).toBe('Hi Jane, I noticed your work at Acme...');
    expect(result.error).toBeUndefined();
  });

  it('returns error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const result = await generateOutreachMessage(
      MOCK_CREDS,
      MOCK_PROFILE,
      'L2',
      ['TypeScript'],
      [],
      'Frontend Engineer',
    );

    expect(result.message).toBe('');
    expect(result.error).toContain('Network error');
  });

  it('returns error on non-ok API response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 429 }),
    );

    const result = await generateOutreachMessage(
      MOCK_CREDS,
      MOCK_PROFILE,
      'L3',
      [],
      ['Python'],
      'Data Engineer',
    );

    expect(result.message).toBe('');
    expect(result.error).toContain('error');
  });

  it('returns error when Cortex returns empty content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(sfResponse('')),
    );

    const result = await generateOutreachMessage(
      MOCK_CREDS,
      MOCK_PROFILE,
      'L1',
      ['TypeScript'],
      [],
      'Engineer',
    );

    expect(result.message).toBe('');
    expect(result.error).toContain('empty');
  });

  it('sends request to Snowflake SQL API endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue(sfResponse('Hello'));
    vi.stubGlobal('fetch', mockFetch);

    await generateOutreachMessage(MOCK_CREDS, MOCK_PROFILE, 'L1', [], [], 'Role');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://test.snowflakecomputing.com/api/v2/statements');
    expect(opts.headers['Authorization']).toBe('Bearer test-pat-token');
    expect(opts.headers['X-Snowflake-Authorization-Token-Type']).toBe('PROGRAMMATIC_ACCESS_TOKEN');
    const body = JSON.parse(opts.body);
    expect(body.statement).toContain('SNOWFLAKE.CORTEX.COMPLETE');
    expect(body.warehouse).toBe('COMPUTE_WH');
  });
});
