import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { fakeBrowser } from '@webext-core/fake-browser';
import { validateStoredApiKey } from '../entrypoints/background';

beforeEach(() => {
  fakeBrowser.reset();
  vi.unstubAllGlobals();
});

afterEach(() => {
  fakeBrowser.reset();
  vi.unstubAllGlobals();
});

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
