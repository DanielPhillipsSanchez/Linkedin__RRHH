// src/storage/storage.ts
// Typed read/write helpers wrapping browser.storage.local.
// All phases import from here. Never use browser.storage.local directly outside this file.

import { STORAGE_KEYS } from './schema';
import type { JobDescription, CandidateRecord } from './schema';

// Storage quota constant — Chrome 113+ allows 10MB for local storage
export const STORAGE_QUOTA_BYTES = 10 * 1024 * 1024; // 10MB

// ---- API Key (deprecated — kept for backward compat) ----

export async function saveApiKey(key: string): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.API_KEY]: key });
}

export async function getApiKey(): Promise<string | undefined> {
  const result = await browser.storage.local.get(STORAGE_KEYS.API_KEY);
  return result[STORAGE_KEYS.API_KEY] as string | undefined;
}

// ---- Claude API Key (Developer Mode) ----

export async function saveClaudeApiKey(key: string): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEYS.CLAUDE_API_KEY]: key });
}

export async function getClaudeApiKey(): Promise<string | undefined> {
  const result = await browser.storage.local.get(STORAGE_KEYS.CLAUDE_API_KEY);
  const key = result[STORAGE_KEYS.CLAUDE_API_KEY] as string | undefined;
  return key || undefined; // treat empty string as not set
}

// ---- Snowflake Credentials ----

export interface SnowflakeCredentials {
  accountUrl: string;
  patToken: string;
  warehouse: string;
}

export async function saveSnowflakeCredentials(creds: SnowflakeCredentials): Promise<void> {
  await browser.storage.local.set({
    [STORAGE_KEYS.SF_ACCOUNT_URL]: creds.accountUrl,
    [STORAGE_KEYS.SF_PAT_TOKEN]: creds.patToken,
    [STORAGE_KEYS.SF_WAREHOUSE]: creds.warehouse,
  });
}

export async function getSnowflakeCredentials(): Promise<SnowflakeCredentials | undefined> {
  const result = await browser.storage.local.get([
    STORAGE_KEYS.SF_ACCOUNT_URL,
    STORAGE_KEYS.SF_PAT_TOKEN,
    STORAGE_KEYS.SF_WAREHOUSE,
  ]);
  const accountUrl = result[STORAGE_KEYS.SF_ACCOUNT_URL] as string | undefined;
  const patToken = result[STORAGE_KEYS.SF_PAT_TOKEN] as string | undefined;
  const warehouse = result[STORAGE_KEYS.SF_WAREHOUSE] as string | undefined;
  if (!accountUrl || !patToken || !warehouse) return undefined;
  return { accountUrl, patToken, warehouse };
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
