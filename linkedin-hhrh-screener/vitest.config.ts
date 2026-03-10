import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    // @webext-core/fake-browser provides in-memory browser.* APIs
    setupFiles: ['./tests/setup.ts'],
  },
});
