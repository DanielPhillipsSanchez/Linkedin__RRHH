// src/storage/storage.ts
// Typed read/write helpers wrapping browser.storage.local.
// All phases import from here. Never use browser.storage.local directly outside this file.

import { STORAGE_KEYS } from './schema';
import type { JobDescription } from './schema';

// Storage quota constant — Chrome 113+ allows 10MB for local storage
export const STORAGE_QUOTA_BYTES = 10 * 1024 * 1024; // 10MB

// ---- API Key ----

export async function saveApiKey(key: string): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.API_KEY]: key });
}

export async function getApiKey(): Promise<string | undefined> {
  const result = await browser.storage.local.get(STORAGE_KEYS.API_KEY);
  return result[STORAGE_KEYS.API_KEY] as string | undefined;
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
