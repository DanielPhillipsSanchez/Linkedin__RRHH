import type { CandidateProfile, ExtractionHealth } from '../parser/types';

export type MessageType = 'VALIDATE_API_KEY' | 'PROFILE_PARSED';

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

export type ExtensionMessage = ValidateApiKeyMessage | ProfileParsedMessage;
