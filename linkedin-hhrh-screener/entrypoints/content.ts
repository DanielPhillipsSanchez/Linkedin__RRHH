import { MatchPattern } from 'wxt/utils/match-patterns';
import { parseProfile } from '../src/parser/parser';
import type { ProfileParsedMessage } from '../src/shared/messages';

const profilePattern = new MatchPattern('https://www.linkedin.com/in/*');

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Wait for the page title to change (SPA nav) or settle (initial load), then extract.
 * @param waitForTitleChange - true on SPA navigation (title still shows previous page)
 */
function waitForProfileAndExtract(waitForTitleChange = false): void {
  if (debounceTimer !== null) clearTimeout(debounceTimer);

  const capturedTitle = document.title; // snapshot before navigation
  let observer: MutationObserver | null = null;
  let settled = false;

  function extract(): void {
    if (settled) return;
    settled = true;
    observer?.disconnect();
    observer = null;
    if (debounceTimer !== null) { clearTimeout(debounceTimer); debounceTimer = null; }
    console.log('[HHRH] extracting — title:', document.title, 'url:', location.href);
    const { profile, health } = parseProfile(document, location.href);
    console.log('[HHRH] parsed name:', profile.name, '| health.ok:', health.ok);
    const msg: ProfileParsedMessage = { type: 'PROFILE_PARSED', profile, health };
    browser.runtime.sendMessage(msg).catch((err) => {
      console.warn('[HHRH] sendMessage failed:', err);
    });
  }

  if (!waitForTitleChange) {
    console.log('[HHRH] initial load — title:', document.title, 'scheduling extract in 500ms');
    debounceTimer = setTimeout(extract, 500);
    return;
  }

  console.log('[HHRH] SPA nav — captured title:', capturedTitle, '— waiting for change');
  // SPA navigation: wait for title to change from the captured snapshot, then extract
  observer = new MutationObserver(() => {
    if (document.title !== capturedTitle) {
      const name = document.title.split('|')[0].trim();
      console.log('[HHRH] title changed to:', document.title);
      if (name && !name.toLowerCase().includes('linkedin')) {
        observer?.disconnect();
        observer = null;
        debounceTimer = setTimeout(extract, 300);
      }
    }
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });

  // Fallback: extract after 5s regardless
  debounceTimer = setTimeout(extract, 5000);
}

function runExtraction(waitForTitleChange = false): void {
  waitForProfileAndExtract(waitForTitleChange);
}

export default defineContentScript({
  matches: ['https://www.linkedin.com/*'], // broad — survives SPA navigation
  main(ctx) {
    // Initial load: title already reflects this profile
    if (profilePattern.includes(location.href)) {
      runExtraction(false);
    }

    // SPA navigation: title still shows previous page — wait for it to change
    ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl }: { newUrl: string }) => {
      if (profilePattern.includes(newUrl)) {
        runExtraction(true);
      }
    });
  },
});
