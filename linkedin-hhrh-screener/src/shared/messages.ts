export type MessageType = 'VALIDATE_API_KEY';

export interface ValidateApiKeyMessage {
  type: 'VALIDATE_API_KEY';
}

export interface ValidateApiKeyResult {
  valid: boolean;
  error?: string;
}

export type ExtensionMessage = ValidateApiKeyMessage;
