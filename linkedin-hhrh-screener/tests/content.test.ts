// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MatchPattern } from 'wxt/utils/match-patterns';

// ---------------------------------------------------------------------------
// debounce helper — extracted for unit testing (mirrors the implementation
// inside content.ts main() without importing the WXT entrypoint itself, since
// defineContentScript requires a browser environment that vitest cannot provide)
// ---------------------------------------------------------------------------

function makeDebounced(fn: (...args: unknown[]) => void, delayMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: unknown[]) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delayMs);
  };
}

// ---------------------------------------------------------------------------
// MatchPattern tests
// ---------------------------------------------------------------------------

describe('MatchPattern — profile URL filter', () => {
  const profilePattern = new MatchPattern('https://www.linkedin.com/in/*');

  it('matches a valid LinkedIn profile URL', () => {
    expect(profilePattern.includes('https://www.linkedin.com/in/someuser')).toBe(true);
  });

  it('matches a profile URL with trailing path', () => {
    expect(profilePattern.includes('https://www.linkedin.com/in/someuser/')).toBe(true);
  });

  it('does NOT match a LinkedIn jobs URL', () => {
    expect(profilePattern.includes('https://www.linkedin.com/jobs')).toBe(false);
  });

  it('does NOT match a LinkedIn feed URL', () => {
    expect(profilePattern.includes('https://www.linkedin.com/feed/')).toBe(false);
  });

  it('does NOT match a non-LinkedIn URL', () => {
    expect(profilePattern.includes('https://www.example.com/in/someuser')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Debounce behaviour tests
// ---------------------------------------------------------------------------

describe('debounce — 400ms extraction trigger', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls the wrapped function exactly once after the delay elapses', () => {
    const spy = vi.fn();
    const debounced = makeDebounced(spy, 400);

    debounced();
    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(400);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('two rapid calls within 400ms produce exactly one invocation', () => {
    const spy = vi.fn();
    const debounced = makeDebounced(spy, 400);

    debounced(); // first call — starts timer
    vi.advanceTimersByTime(200); // 200ms pass — timer still pending
    debounced(); // second call — resets timer
    vi.advanceTimersByTime(400); // 400ms after second call — fires once

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('three rapid calls within 400ms produce exactly one invocation', () => {
    const spy = vi.fn();
    const debounced = makeDebounced(spy, 400);

    debounced();
    vi.advanceTimersByTime(100);
    debounced();
    vi.advanceTimersByTime(100);
    debounced();
    vi.advanceTimersByTime(400);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire before 400ms have elapsed', () => {
    const spy = vi.fn();
    const debounced = makeDebounced(spy, 400);

    debounced();
    vi.advanceTimersByTime(399);

    expect(spy).not.toHaveBeenCalled();
  });

  it('two calls separated by >400ms produce two invocations', () => {
    const spy = vi.fn();
    const debounced = makeDebounced(spy, 400);

    debounced();
    vi.advanceTimersByTime(500); // first call fires
    debounced();
    vi.advanceTimersByTime(500); // second call fires

    expect(spy).toHaveBeenCalledTimes(2);
  });
});
