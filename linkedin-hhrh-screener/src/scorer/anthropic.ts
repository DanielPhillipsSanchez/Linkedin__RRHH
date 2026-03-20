// src/scorer/anthropic.ts
// Direct Anthropic Claude API caller.
// x-api-key is a custom header (not restricted by Chrome), so it is sent directly
// in the fetch call — no declarativeNetRequest workaround needed.

export interface AnthropicResponse {
  text: string;
  error?: string;
}

const ANTHROPIC_HEADERS = (apiKey: string) => ({
  'Content-Type': 'application/json',
  'x-api-key': apiKey,
  'anthropic-version': '2023-06-01',
  'anthropic-dangerous-direct-browser-access': 'true',
});

/**
 * Calls the Anthropic Messages API directly.
 * Requires `https://api.anthropic.com/*` in host_permissions.
 */
export async function anthropicComplete(
  apiKey: string,
  prompt: string,
  model = 'claude-haiku-4-5-20251001',
  maxTokens = 1024,
): Promise<AnthropicResponse> {
  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(60_000),
      headers: ANTHROPIC_HEADERS(apiKey),
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch {
    return { text: '', error: 'Network error connecting to Anthropic API' };
  }

  if (response.status === 401) {
    return { text: '', error: 'auth' };
  }
  if (!response.ok) {
    return { text: '', error: `Anthropic API error ${response.status}` };
  }

  const data = await response.json() as AnthropicApiResponse;
  const text = data.content?.[0]?.text?.trim() ?? '';
  if (!text) return { text: '', error: 'Empty response from Claude API' };
  return { text };
}

/**
 * Validates a Claude API key by sending a minimal request.
 */
export async function validateAnthropicApiKey(
  apiKey: string,
): Promise<{ valid: boolean; error?: string }> {
  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers: ANTHROPIC_HEADERS(apiKey),
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Network error: ${msg}` };
  }

  if (response.status === 401) {
    return { valid: false, error: 'Invalid API key — check your key in Options' };
  }
  if (!response.ok) {
    return { valid: false, error: `Anthropic API error ${response.status}` };
  }
  return { valid: true };
}

// Anthropic Messages API response shape (partial)
interface AnthropicApiResponse {
  content?: Array<{ type: string; text: string }>;
}
