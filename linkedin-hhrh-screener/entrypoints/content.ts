import { MatchPattern } from 'wxt/utils/match-patterns';
import { parseProfile } from '../src/parser/parser';
import type { ProfileParsedMessage } from '../src/shared/messages';

const profilePattern = new MatchPattern('https://www.linkedin.com/in/*');

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function profileIsUsable(profile: ReturnType<typeof parseProfile>['profile']): boolean {
  return !!(profile.about || profile.headline || profile.experience.length > 0 || profile.skills.length > 0);
}

/**
 * Parse and send profile. If key sections are empty (lazy-load not done yet),
 * retry up to maxRetries times with increasing delays.
 */
function extractAndSend(retryDelays = [1500, 3000]): void {
  const { profile, health } = parseProfile(document, location.href);
  console.log('[HHRH] parsed name:', profile.name, '| usable:', profileIsUsable(profile), '| about:', profile.about.slice(0, 60) || '(empty)', '| skills:', profile.skills.length);

  if (!profileIsUsable(profile) && retryDelays.length > 0) {
    const [next, ...rest] = retryDelays;
    console.log(`[HHRH] sections empty — retrying in ${next}ms`);
    setTimeout(() => extractAndSend(rest), next);
    return;
  }

  console.log('[HHRH] sending profile — experience:', profile.experience.length, 'skills:', profile.skills.length);
  const msg: ProfileParsedMessage = { type: 'PROFILE_PARSED', profile, health };
  browser.runtime.sendMessage(msg).catch((err) => {
    console.warn('[HHRH] sendMessage failed:', err);
  });
}

/**
 * Wait for the page title to change (SPA nav) or settle (initial load), then extract.
 * @param waitForTitleChange - true on SPA navigation (title still shows previous page)
 */
function waitForProfileAndExtract(waitForTitleChange = false): void {
  if (debounceTimer !== null) clearTimeout(debounceTimer);

  const capturedTitle = document.title;
  let observer: MutationObserver | null = null;
  let settled = false;

  function extract(): void {
    if (settled) return;
    settled = true;
    observer?.disconnect();
    observer = null;
    if (debounceTimer !== null) { clearTimeout(debounceTimer); debounceTimer = null; }
    console.log('[HHRH] extracting — title:', document.title, 'url:', location.href);
    extractAndSend();
  }

  if (!waitForTitleChange) {
    console.log('[HHRH] initial load — scheduling extract in 1500ms');
    debounceTimer = setTimeout(extract, 1500);
    return;
  }

  console.log('[HHRH] SPA nav — captured title:', capturedTitle, '— waiting for change');
  observer = new MutationObserver(() => {
    if (document.title !== capturedTitle) {
      const name = document.title.split('|')[0].trim();
      console.log('[HHRH] title changed to:', document.title);
      if (name && !name.toLowerCase().includes('linkedin')) {
        observer?.disconnect();
        observer = null;
        debounceTimer = setTimeout(extract, 1000);
      }
    }
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });

  // Fallback: extract after 8s regardless
  debounceTimer = setTimeout(extract, 8000);
}

function runExtraction(waitForTitleChange = false): void {
  waitForProfileAndExtract(waitForTitleChange);
}

export default defineContentScript({
  matches: ['https://www.linkedin.com/*'],
  main(ctx) {
    if (profilePattern.includes(location.href)) {
      runExtraction(false);
    }

    ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl }: { newUrl: string }) => {
      if (profilePattern.includes(newUrl)) {
        runExtraction(true);
      }
    });
  },
});
