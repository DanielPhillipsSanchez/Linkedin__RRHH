import { describe, it, beforeEach, afterEach } from 'vitest';
import { fakeBrowser } from '@webext-core/fake-browser';

beforeEach(() => fakeBrowser.reset());
afterEach(() => fakeBrowser.reset());

describe('saveApiKey', () => {
  it.todo('writes api key to storage');
  it.todo('overwrites existing key');
});

describe('saveJd', () => {
  it.todo('saves JD and adds id to index');
  it.todo('saveJd rawText: preserves pasted text in rawText field');
  it.todo('does not duplicate index entry on re-save');
});

describe('getAllJds', () => {
  it.todo('returns empty array when no JDs saved');
  it.todo('returns all saved JDs in index order');
});

describe('skill weight', () => {
  it.todo('persists mandatory skill weight');
  it.todo('persists nice-to-have skill weight');
});

describe('activeJdId', () => {
  it.todo('setActiveJdId persists and getActiveJdId retrieves');
  it.todo('returns undefined when no active JD set');
});

describe('deleteJd clears active', () => {
  it.todo('deleteJd removes JD from index and storage');
  it.todo('deleteJd clears activeJdId when deleted JD was active');
  it.todo('deleteJd does not clear activeJdId when a different JD is deleted');
});
