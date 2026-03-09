import { describe, it, beforeEach, afterEach } from 'vitest';
import { fakeBrowser } from '@webext-core/fake-browser';

beforeEach(() => fakeBrowser.reset());
afterEach(() => fakeBrowser.reset());

describe('validateStoredApiKey', () => {
  it.todo('returns invalid when no api key is stored');
  it.todo('returns valid result when background fetch succeeds with 200');
  it.todo('returns invalid with error message when fetch returns 401');
  it.todo('returns invalid with network error message when fetch throws');
});
