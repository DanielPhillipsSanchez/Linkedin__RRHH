import { MatchPattern } from 'wxt/utils/match-patterns';
import { parseProfile } from '../src/parser/parser';
import type { ProfileParsedMessage } from '../src/shared/messages';

const profilePattern = new MatchPattern('https://www.linkedin.com/in/*');

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/** Wait for the profile name (h1) to appear, then extract. Fallback after 5s. */
function waitForProfileAndExtract(): void {
  if (debounceTimer !== null) clearTimeout(debounceTimer);

  let observer: MutationObserver | null = null;
  let settled = false;

  function extract(): void {
    if (settled) return;
    settled = true;
    observer?.disconnect();
    if (debounceTimer !== null) clearTimeout(debounceTimer);

    const { profile, health } = parseProfile(document, location.href);
    const msg: ProfileParsedMessage = { type: 'PROFILE_PARSED', profile, health };
    browser.runtime.sendMessage(msg).catch((err) => {
      console.warn('[HHRH] sendMessage failed (background restarting?):', err);
    });
  }

  // If name element already present, extract after short settle delay
  if (document.querySelector('h1')?.textContent?.trim()) {
    debounceTimer = setTimeout(extract, 300);
    return;
  }

  // Otherwise observe DOM until h1 has text content
  observer = new MutationObserver(() => {
    if (document.querySelector('h1')?.textContent?.trim()) {
      extract();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Fallback: extract after 5s regardless
  debounceTimer = setTimeout(extract, 5000);
}

function runExtraction(): void {
  waitForProfileAndExtract();
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
