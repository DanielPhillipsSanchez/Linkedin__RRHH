// src/scorer/anthropic.ts
// Direct Anthropic Claude API caller for Developer mode.
// Uses declarativeNetRequest to inject the x-api-key header because
// Chrome MV3 service workers strip Authorization headers on cross-origin fetches.

export interface AnthropicResponse {
  text: string;
  error?: string;
}

let nextRuleId = 100; // Offset from cortex.ts rule IDs to avoid collisions

async function installAnthropicAuthRule(
  apiKey: string,
): Promise<{ cleanup: () => Promise<void> }> {
  const ruleId = nextRuleId++;

  const rule: chrome.declarativeNetRequest.Rule = {
    id: ruleId,
    priority: 1,
    action: {
      type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
      requestHeaders: [
        {
          header: 'x-api-key',
          operation: chrome.declarativeNetRequest.HeaderOperation.SET,
          value: apiKey,
        },
        {
          header: 'anthropic-version',
          operation: chrome.declarativeNetRequest.HeaderOperation.SET,
          value: '2023-06-01',
        },
      ],
    },
    condition: {
      urlFilter: '||api.anthropic.com/v1/messages',
      resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST],
    },
  };

  await chrome.declarativeNetRequest.updateSessionRules({ addRules: [rule] });

  return {
    cleanup: async () => {
      await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [ruleId] });
    },
  };
}

/**
 * Calls the Anthropic Messages API directly.
 * Requires `https://api.anthropic.com/*` in host_permissions.
 */
export async function anthropicComplete(
  apiKey: string,
  prompt: string,
  model = 'claude-haiku-4-5-20251001',
): Promise<AnthropicResponse> {
  const { cleanup } = await installAnthropicAuthRule(apiKey);

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(60_000),
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch {
    await cleanup();
    return { text: '', error: 'Network error connecting to Anthropic API' };
  }

  await cleanup();

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
  const { cleanup } = await installAnthropicAuthRule(apiKey);

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });
  } catch (err) {
    await cleanup();
    const msg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `Network error: ${msg}` };
  }

  await cleanup();

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
