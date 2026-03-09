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

  // If page title already has the candidate name, extract after short settle delay
  const titleName = document.title.split('|')[0].trim();
  if (titleName && !titleName.toLowerCase().includes('linkedin')) {
    debounceTimer = setTimeout(extract, 300);
    return;
  }

  // Otherwise observe DOM until page title updates with the profile name
  observer = new MutationObserver(() => {
    const name = document.title.split('|')[0].trim();
    if (name && !name.toLowerCase().includes('linkedin')) {
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
