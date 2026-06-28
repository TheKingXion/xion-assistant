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
  AI_SMALL_MODEL?: string;
  AI_TTS_PROVIDER?: string;
  AI_TTS_DEFAULT_VOICE?: string;
  AI_TTS_DEFAULT_LANGUAGE?: string;
  AI_TTS_DEFAULT_SPEED?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  SPOTIFY_CLIENT_ID?: string;
  SPOTIFY_CLIENT_SECRET?: string;
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

export type ContactRecord = {
  id: string;
  userId: string;
  displayName: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type ContactAliasRecord = {
  id: string;
  userId: string;
  contactId: string;
  alias: string;
  confirmed: boolean;
  createdAt: string;
};

export type ContactChannelRecord = {
  id: string;
  userId: string;
  contactId: string;
  channel: string;
  address: string;
  isPreferred: boolean;
  createdAt: string;
};

export type ResolvedContactRecord = {
  contact: ContactRecord;
  alias?: ContactAliasRecord;
  preferredChannel?: ContactChannelRecord;
};

export type OAuthProvider = "google" | "spotify";

export type OAuthAccountRecord = {
  id: string;
  userId: string;
  provider: OAuthProvider;
  providerUserId: string;
  scopes: string[];
  expiresAt?: string;
  createdAt: string;
};

export type OAuthAccountSecretRecord = OAuthAccountRecord & {
  encryptedAccessToken?: string;
  encryptedRefreshToken?: string;
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

export type SessionRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  deviceId?: string;
  expiresAt: string;
  createdAt: string;
};

export type AssistantActionRecord = {
  id: string;
  userId: string;
  conversationId?: string;
  toolName: string;
  riskLevel: "low" | "medium" | "high";
  status: "draft" | "pending_confirmation" | "running" | "completed" | "failed" | "cancelled";
  inputJson: string;
  resultJson?: string;
  createdAt: string;
  updatedAt: string;
};

export type ActionConfirmationRecord = {
  id: string;
  userId: string;
  actionId: string;
  decision: "confirmed" | "cancelled" | "edited";
  confirmedPayloadJson?: string;
  createdAt: string;
};

export type AssistantPlanRecord = {
  id: string;
  userId: string;
  conversationId?: string;
  status: "draft" | "pending_confirmation" | "running" | "completed" | "failed" | "cancelled";
  title: string;
  goal: string;
  riskLevel: "low" | "medium" | "high";
  createdAt: string;
  updatedAt: string;
};

export type AssistantPlanStepRecord = {
  id: string;
  planId: string;
  orderIndex: number;
  title: string;
  description?: string;
  toolName?: string;
  status: string;
  requiresConfirmation: boolean;
  resultJson?: string;
};
