import type { CandidateProfile, ExtractionHealth } from '../parser/types';
import type { Tier } from '../scorer/tiers';

export type MessageType = 'VALIDATE_API_KEY' | 'PROFILE_PARSED' | 'EVALUATE';

export interface ValidateApiKeyMessage {
  type: 'VALIDATE_API_KEY';
}

export interface ValidateApiKeyResult {
  valid: boolean;
  error?: string;
}

export interface ProfileParsedMessage {
  type: 'PROFILE_PARSED';
  profile: CandidateProfile;
  health: ExtractionHealth;
  tabId?: number;
}

export interface EvaluateMessage {
  type: 'EVALUATE';
}

export interface EvaluateResult {
  score: number;
  tier: Tier;
  tierLabel: string;
  matchedSkills: string[];
  missingSkills: string[];
  rationale: string;
  candidateId: string;
  error?: string;
}

export type ExtensionMessage = ValidateApiKeyMessage | ProfileParsedMessage | EvaluateMessage;
