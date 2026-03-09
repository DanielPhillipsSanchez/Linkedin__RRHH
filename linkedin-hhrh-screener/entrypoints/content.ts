export default defineContentScript({
  matches: ['https://www.linkedin.com/in/*'],
  main() {
    console.log('[HHRH] Content script loaded on LinkedIn profile');
    // Phase 1: scaffold only — extraction in Phase 2
  },
});
