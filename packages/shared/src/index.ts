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
  userId: z.string().min(1).optional(),
  message: z.string().min(1).max(8000),
  conversationId: z.string().optional(),
  spokenResponse: z.boolean().default(false),
  platform: z.enum(["web", "windows", "android", "ios", "unknown"]).default("unknown"),
  timezone: z.string().trim().min(1).max(100).optional()
});
export type AssistantRequest = z.infer<typeof assistantRequestSchema>;

export const commandShortcutSchema = z.object({
  shortcut: z.string().trim().min(1).max(120),
  intent: z.string().trim().min(1).max(120),
  params: z.record(z.unknown()).default({}),
  confidence: z.number().min(0).max(1).default(1),
  confirmed: z.boolean().default(true),
  isActive: z.boolean().default(true)
});

export const commandMatchSchema = z.object({
  text: z.string().trim().min(1).max(8000),
  platform: z.enum(["web", "windows", "android", "ios", "unknown"]).default("unknown"),
  timezone: z.string().trim().min(1).max(100).default("America/Santiago")
});

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
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  requiredScopes: string[];
  requiresAuth: boolean;
  requiresConfirmation: boolean;
  riskLevel: RiskLevel;
};

export const mustConfirm = (riskLevel: RiskLevel) => riskLevel === "high";

export const assistantPlanSchema = z.object({
  title: z.string().min(1),
  goal: z.string().min(1),
  riskLevel: riskLevelSchema,
  steps: z.array(
    z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      toolName: z.string().optional(),
      requiresConfirmation: z.boolean()
    })
  )
});
export type AssistantPlan = z.infer<typeof assistantPlanSchema>;

export const aiGatewayUsageSchema = z.object({
  provider: z.string(),
  model: z.string(),
  tokensInput: z.number().int().nonnegative(),
  tokensOutput: z.number().int().nonnegative(),
  estimatedCostUsd: z.number().nonnegative().optional()
});
export type AiGatewayUsage = z.infer<typeof aiGatewayUsageSchema>;
