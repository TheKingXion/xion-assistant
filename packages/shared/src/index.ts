import { z } from "zod";

export const riskLevelSchema = z.enum(["low", "medium", "high"]);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

export const actionStatusSchema = z.enum([
  "draft",
  "pending_confirmation",
  "running",
  "completed",
  "failed",
  "cancelled"
]);
export type ActionStatus = z.infer<typeof actionStatusSchema>;

export const voiceSettingsSchema = z.object({
  userId: z.string().min(1),
  ttsEnabled: z.boolean(),
  sttEnabled: z.boolean(),
  wakeWordEnabled: z.boolean(),
  selectedVoiceId: z.string().min(1),
  language: z.string().min(2),
  speed: z.number().min(0.5).max(2),
  pitch: z.number().min(0.5).max(2),
  volume: z.number().min(0).max(1),
  autoPlayResponses: z.boolean()
});
export type VoiceSettings = z.infer<typeof voiceSettingsSchema>;

export const assistantRequestSchema = z.object({
  userId: z.string().min(1),
  message: z.string().min(1).max(8000),
  conversationId: z.string().optional(),
  spokenResponse: z.boolean().default(false)
});
export type AssistantRequest = z.infer<typeof assistantRequestSchema>;

export const updateManifestSchema = z.object({
  version: z.string().min(1),
  platform: z.enum(["windows", "android"]),
  arch: z.string().optional(),
  channel: z.enum(["stable", "beta", "internal"]),
  download_url: z.string().url(),
  sha256: z.string().length(64),
  size: z.number().int().positive(),
  changelog: z.string(),
  required: z.boolean(),
  min_supported_version: z.string(),
  published_at: z.string()
});
export type UpdateManifest = z.infer<typeof updateManifestSchema>;

export type ToolDefinition = {
  name: string;
  description: string;
  requiredScopes: string[];
  requiresAuth: boolean;
  requiresConfirmation: boolean;
  riskLevel: RiskLevel;
};

export const mustConfirm = (riskLevel: RiskLevel) => riskLevel === "high";
