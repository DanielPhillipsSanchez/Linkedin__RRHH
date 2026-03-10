// src/storage/schema.ts
// Storage key constants — single source of truth for all chrome.storage.local keys.
// All phases import from here; never hardcode key strings elsewhere.

export const STORAGE_KEYS = {
  ANTHROPIC_API_KEY: 'settings:anthropicApiKey',
  ACTIVE_JD_ID: 'settings:activeJdId',
  DATA_RETENTION_DAYS: 'settings:dataRetentionDays',
  JD_INDEX: 'jd:index',
  jd: (id: string) => `jd:${id}` as const,
  candidate: (id: string) => `candidate:${id}` as const,
  CANDIDATE_INDEX: 'candidate:index',
} as const;

export interface Skill {
  text: string;
  weight: 'mandatory' | 'nice-to-have';
}

export interface JobDescription {
  id: string;          // UUID from crypto.randomUUID()
  title: string;       // Human-readable name e.g. "Senior Backend Engineer"
  rawText: string;     // Full pasted JD text
  skills: Skill[];     // Tagged skill list
  createdAt: string;   // ISO 8601
  updatedAt: string;   // ISO 8601
}

// CandidateRecord used by Phase 3+; defined here for schema completeness
export interface CandidateRecord {
  id: string;
  name: string;
  profileUrl: string;
  linkedinHeadline: string;
  score: number;
  tier: 'L1' | 'L2' | 'L3' | 'rejected';
  matchedSkills: string[];
  missingSkills: string[];
  outreachMessage: string;
  evaluatedAt: string;        // ISO 8601
  contactAfter?: string;      // ISO 8601 — L3 only (evaluatedAt + 7 days)
  jdId: string;
  messageSentAt?: string;     // ISO 8601
  messageSentText?: string;
  expiresAt: string;          // ISO 8601 — for GDPR cleanup
}
