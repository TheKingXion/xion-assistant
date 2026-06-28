export type Env = {
  DB?: D1Database;
  RELEASES?: R2Bucket;
  PUBLIC_WEB_URL: string;
  PUBLIC_API_URL: string;
  JWT_SECRET?: string;
  TOKEN_ENCRYPTION_KEY?: string;
  AI_PROVIDER?: string;
  AI_API_KEY?: string;
  AI_MODEL?: string;
  AI_TTS_PROVIDER?: string;
  AI_TTS_DEFAULT_VOICE?: string;
  AI_TTS_DEFAULT_LANGUAGE?: string;
  AI_TTS_DEFAULT_SPEED?: string;
};

export type UserRecord = {
  id: string;
  email: string;
  displayName: string;
  passwordHash?: string;
  createdAt: string;
};

export type MemoryRecord = {
  id: string;
  userId: string;
  memoryType: string;
  key: string;
  value: string;
  confirmed: boolean;
  confidence: number;
  createdAt: string;
};

export type VoiceSettingsRecord = {
  userId: string;
  ttsEnabled: boolean;
  sttEnabled: boolean;
  wakeWordEnabled: boolean;
  selectedVoiceId: string;
  language: string;
  speed: number;
  pitch: number;
  volume: number;
  autoPlayResponses: boolean;
};
