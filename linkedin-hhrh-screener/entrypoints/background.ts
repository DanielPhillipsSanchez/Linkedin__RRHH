import { getApiKey } from '../src/storage/storage';
import type { ProfileParsedMessage } from '../src/shared/messages';
import type { CandidateProfile, ExtractionHealth } from '../src/parser/types';

let lastParsedProfile: { profile: CandidateProfile; health: ExtractionHealth } | null = null;

export function getLastParsedProfile(): { profile: CandidateProfile; health: ExtractionHealth } | null {
  return lastParsedProfile;
}

export async function validateStoredApiKey(): Promise<{ valid: boolean; error?: string }> {
  const apiKey = await getApiKey();
  if (!apiKey) return { valid: false, error: 'No API key stored' };

  try {
    const response = await fetch('https://api.anthropic.com/v1/models?limit=1', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    });

    if (response.ok) return { valid: true };
    if (response.status === 401) return { valid: false, error: 'Invalid API key' };
    return { valid: false, error: `HTTP ${response.status}` };
  } catch {
    return { valid: false, error: 'Network error — check your connection' };
  }
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'VALIDATE_API_KEY') {
      validateStoredApiKey().then(sendResponse);
      return true; // CRITICAL: keep channel open for async response
    }

    if (message.type === 'PROFILE_PARSED') {
      const msg = message as ProfileParsedMessage;
      lastParsedProfile = { profile: msg.profile, health: msg.health };
      console.log('[HHRH] Profile parsed:', msg.profile.name, '| Health ok:', msg.health.ok);
      sendResponse({ received: true });
      return true;
    }
  });
});
