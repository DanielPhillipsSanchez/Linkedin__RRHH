import type { CandidateProfile, ExtractionHealth } from '../parser/types';
import type { Tier } from '../scorer/tiers';

export type MessageType =
  | 'VALIDATE_API_KEY'
  | 'PROFILE_PARSED'
  | 'EVALUATE'
  | 'GENERATE_MESSAGE'
  | 'SAVE_MESSAGE'
  | 'SAVE_PHONE';

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
  experienceLevel?: 'junior' | 'mid' | 'senior' | 'staff';
  redFlags?: Array<{ flag: string; question: string; expectedAnswer: string }>;
  candidateId: string;
  error?: string;
  /** Non-fatal warning (e.g. Claude API error — score is keyword-only) */
  warning?: string;
}

export interface GenerateMessageMessage {
  type: 'GENERATE_MESSAGE';
  candidateId: string;
}

export interface GenerateMessageResult {
  message: string;
  error?: string;
}

export interface SaveMessageMessage {
  type: 'SAVE_MESSAGE';
  candidateId: string;
  messageText: string;
}

export interface SaveMessageResult {
  saved: boolean;
  error?: string;
}

export interface SavePhoneMessage {
  type: 'SAVE_PHONE';
  candidateId: string;
  phoneNumber: string;
}

export interface SavePhoneResult {
  saved: boolean;
  error?: string;
}

export type ExtensionMessage =
  | ValidateApiKeyMessage
  | ProfileParsedMessage
  | EvaluateMessage
  | GenerateMessageMessage
  | SaveMessageMessage
  | SavePhoneMessage;
