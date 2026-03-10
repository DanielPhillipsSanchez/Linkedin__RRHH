import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateOutreachMessage } from '../src/scorer/messenger';
import type { CandidateProfile } from '../src/parser/types';

afterEach(() => {
  vi.unstubAllGlobals();
});

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

describe('generateOutreachMessage', () => {
  it('returns message text on successful API call', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Hi Jane, I noticed your work at Acme...' }],
        }),
      }),
    );

    const result = await generateOutreachMessage(
      'test-key',
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
      'test-key',
      MOCK_PROFILE,
      'L2',
      ['TypeScript'],
      [],
      'Frontend Engineer',
    );

    expect(result.message).toBe('');
    expect(result.error).toBe('Network error generating message');
  });

  it('returns error on non-ok API response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 429 }),
    );

    const result = await generateOutreachMessage(
      'test-key',
      MOCK_PROFILE,
      'L3',
      [],
      ['Python'],
      'Data Engineer',
    );

    expect(result.message).toBe('');
    expect(result.error).toBe('Claude API error 429');
  });

  it('returns error when Claude returns empty content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ type: 'text', text: '' }] }),
      }),
    );

    const result = await generateOutreachMessage(
      'test-key',
      MOCK_PROFILE,
      'L1',
      ['TypeScript'],
      [],
      'Engineer',
    );

    expect(result.message).toBe('');
    expect(result.error).toBe('Claude returned empty message');
  });

  it('sends correct model and headers in API request', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'Hello' }] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await generateOutreachMessage('my-api-key', MOCK_PROFILE, 'L1', [], [], 'Role');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(opts.headers['x-api-key']).toBe('my-api-key');
    const body = JSON.parse(opts.body);
    expect(body.model).toBe('claude-haiku-4-5-20251001');
  });
});
