// src/storage/storage.ts
// Typed read/write helpers wrapping browser.storage.local.
// All phases import from here. Never use browser.storage.local directly outside this file.

import { STORAGE_KEYS } from './schema';
import type { JobDescription, CandidateRecord } from './schema';

// Storage quota constant — Chrome 113+ allows 10MB for local storage
export const STORAGE_QUOTA_BYTES = 10 * 1024 * 1024; // 10MB

// ---- Anthropic API Key ----

export async function saveAnthropicApiKey(key: string): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.ANTHROPIC_API_KEY]: key });
}

export async function getAnthropicApiKey(): Promise<string | undefined> {
  // Build-time key takes priority (set in .env as VITE_ANTHROPIC_API_KEY)
  const builtInKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (builtInKey) return builtInKey;

  const result = await browser.storage.local.get(STORAGE_KEYS.ANTHROPIC_API_KEY);
  const key = result[STORAGE_KEYS.ANTHROPIC_API_KEY] as string | undefined;
  return key || undefined;
}

/** True when the API key is baked in at build time and no manual entry is needed. */
export function isApiKeyBuiltIn(): boolean {
  return !!import.meta.env.VITE_ANTHROPIC_API_KEY;
}

// ---- Job Descriptions ----

async function getJdIndex(): Promise<string[]> {
  const result = await browser.storage.local.get(STORAGE_KEYS.JD_INDEX);
  return (result[STORAGE_KEYS.JD_INDEX] as string[] | undefined) ?? [];
}

export async function saveJd(jd: JobDescription): Promise<void> {
  const ids = await getJdIndex();
  if (!ids.includes(jd.id)) {
    ids.push(jd.id);
    await browser.storage.local.set({ [STORAGE_KEYS.JD_INDEX]: ids });
  }
  await browser.storage.local.set({ [STORAGE_KEYS.jd(jd.id)]: jd });
}

export async function getAllJds(): Promise<JobDescription[]> {
  const ids = await getJdIndex();
  if (ids.length === 0) return [];
  const keys = ids.map((id) => STORAGE_KEYS.jd(id));
  const result = await browser.storage.local.get(keys);
  return keys.map((k) => result[k]).filter(Boolean) as JobDescription[];
}

export async function deleteJd(jdId: string): Promise<void> {
  // Remove from index
  const ids = await getJdIndex();
  const updated = ids.filter((id) => id !== jdId);
  await browser.storage.local.set({ [STORAGE_KEYS.JD_INDEX]: updated });

  // Remove JD data
  await browser.storage.local.remove(STORAGE_KEYS.jd(jdId));

  // Clear activeJdId if it was the deleted JD
  const activeResult = await browser.storage.local.get(STORAGE_KEYS.ACTIVE_JD_ID);
  if (activeResult[STORAGE_KEYS.ACTIVE_JD_ID] === jdId) {
    await browser.storage.local.remove(STORAGE_KEYS.ACTIVE_JD_ID);
  }
}

// ---- Active JD Selection ----

export async function setActiveJdId(jdId: string): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.ACTIVE_JD_ID]: jdId });
}

export async function getActiveJdId(): Promise<string | undefined> {
  const result = await browser.storage.local.get(STORAGE_KEYS.ACTIVE_JD_ID);
  return result[STORAGE_KEYS.ACTIVE_JD_ID] as string | undefined;
}

// ---- Storage Quota Monitoring ----

export async function getStorageUsageBytes(): Promise<number> {
  // getBytesInUse may not be available in all environments (e.g., test fake-browser)
  if (typeof browser.storage.local.getBytesInUse !== 'function') {
    return 0;
  }
  return browser.storage.local.getBytesInUse(null);
}

// ---- Candidates ----

async function getCandidateIndex(): Promise<string[]> {
  const result = await browser.storage.local.get(STORAGE_KEYS.CANDIDATE_INDEX);
  return (result[STORAGE_KEYS.CANDIDATE_INDEX] as string[] | undefined) ?? [];
}

export async function saveCandidate(record: CandidateRecord): Promise<void> {
  const ids = await getCandidateIndex();
  if (!ids.includes(record.id)) {
    ids.push(record.id);
    await browser.storage.local.set({ [STORAGE_KEYS.CANDIDATE_INDEX]: ids });
  }
  await browser.storage.local.set({ [STORAGE_KEYS.candidate(record.id)]: record });
}

export async function getAllCandidates(): Promise<CandidateRecord[]> {
  const ids = await getCandidateIndex();
  if (ids.length === 0) return [];
  const keys = ids.map((id) => STORAGE_KEYS.candidate(id));
  const result = await browser.storage.local.get(keys);
  const records = keys.map((k) => result[k]).filter(Boolean) as CandidateRecord[];
  return records.sort((a, b) => b.evaluatedAt.localeCompare(a.evaluatedAt));
}

export async function getCandidate(id: string): Promise<CandidateRecord | undefined> {
  const result = await browser.storage.local.get(STORAGE_KEYS.candidate(id));
  return result[STORAGE_KEYS.candidate(id)] as CandidateRecord | undefined;
}

export async function deleteCandidate(id: string): Promise<void> {
  const ids = await getCandidateIndex();
  const updated = ids.filter((existingId) => existingId !== id);
  await browser.storage.local.set({ [STORAGE_KEYS.CANDIDATE_INDEX]: updated });
  await browser.storage.local.remove(STORAGE_KEYS.candidate(id));
}

export async function clearAllCandidates(): Promise<void> {
  const ids = await getCandidateIndex();
  const keys = ids.map((id) => STORAGE_KEYS.candidate(id));
  if (keys.length > 0) {
    await browser.storage.local.remove(keys);
  }
  await browser.storage.local.set({ [STORAGE_KEYS.CANDIDATE_INDEX]: [] });
}
