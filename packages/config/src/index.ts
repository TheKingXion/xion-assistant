import { z } from "zod";

export const publicConfigSchema = z.object({
  PUBLIC_WEB_URL: z.string().url().default("https://assistant.xion.<TU_DOMINIO>"),
  PUBLIC_API_URL: z.string().url().default("https://api.asst.xion.<TU_DOMINIO>")
});

export const secretConfigSchema = z.object({
  JWT_SECRET: z.string().min(32),
  TOKEN_ENCRYPTION_KEY: z.string().min(32),
  AI_PROVIDER: z.string().default("mock"),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("mock-assistant"),
  AI_TTS_PROVIDER: z.string().default("mock"),
  AI_TTS_DEFAULT_VOICE: z.string().default("xion_voice_1"),
  AI_TTS_DEFAULT_LANGUAGE: z.string().default("es-CL"),
  AI_TTS_DEFAULT_SPEED: z.string().default("1")
});

export type PublicConfig = z.infer<typeof publicConfigSchema>;
export type SecretConfig = z.infer<typeof secretConfigSchema>;
