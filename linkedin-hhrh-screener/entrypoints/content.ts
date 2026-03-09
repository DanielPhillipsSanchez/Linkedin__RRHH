import { MatchPattern } from 'wxt/utils/match-patterns';
import { parseProfile } from '../src/parser/parser';
import type { ProfileParsedMessage } from '../src/shared/messages';

const profilePattern = new MatchPattern('https://www.linkedin.com/in/*');

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function runExtraction(): void {
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    debounceTimer = null;
    const { profile, health } = parseProfile(document, location.href);
    const msg: ProfileParsedMessage = { type: 'PROFILE_PARSED', profile, health };
    try {
      await browser.runtime.sendMessage(msg);
    } catch (err) {
      // Background may be restarting — log and continue
      console.warn('[HHRH] sendMessage failed (background restarting?):', err);
    }
  }, 400);
}

export default defineContentScript({
  matches: ['https://www.linkedin.com/*'], // broad — survives SPA navigation
  main(ctx) {
    // Initial load: run immediately if we are on a profile page
    if (profilePattern.includes(location.href)) {
      runExtraction();
    }

    // SPA navigation: wxt:locationchange fires on every pushState/replaceState
    ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl }: { newUrl: string }) => {
      if (profilePattern.includes(newUrl)) {
        runExtraction();
      }
    });
  },
});
