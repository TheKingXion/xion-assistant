import { zValidator } from "@hono/zod-validator";
import { assistantRequestSchema, updateManifestSchema, voiceSettingsSchema } from "@xion-assistant/shared";
import { listVoices, synthesizeSpeech } from "@xion-assistant/voice";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { handleAssistantMessage } from "./services/assistant-engine";
import { repository } from "./services/repositories";
import { createSessionToken, hashPassword, verifyPassword } from "./services/security";
import type { Env } from "./types";

export const app = new Hono<{ Bindings: Env }>();

app.use(
  "*",
  cors({
    origin: (origin, c) => origin || c.env.PUBLIC_WEB_URL || "http://localhost:5173",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true
  })
);

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    name: "xion-assistant-api",
    version: "0.0.1",
    routes: {
      web: c.env.PUBLIC_WEB_URL,
      api: c.env.PUBLIC_API_URL
    }
  })
);

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).optional()
});

app.post("/api/auth/register", zValidator("json", authSchema), async (c) => {
  const body = c.req.valid("json");
  const passwordHash = await hashPassword(body.password);
  const user = repository.createUser({
    email: body.email,
    displayName: body.displayName ?? body.email.split("@")[0] ?? "User",
    passwordHash
  });
  const token = await createSessionToken(user.id, c.env.JWT_SECRET);
  return c.json({ ok: true, user: { id: user.id, email: user.email, displayName: user.displayName }, token });
});

app.post("/api/auth/login", zValidator("json", authSchema.omit({ displayName: true })), async (c) => {
  const body = c.req.valid("json");
  const user = repository.findUserByEmail(body.email);
  if (!user?.passwordHash || !(await verifyPassword(body.password, user.passwordHash))) {
    return c.json({ ok: false, error: "invalid_credentials" }, 401);
  }
  const token = await createSessionToken(user.id, c.env.JWT_SECRET);
  return c.json({ ok: true, user: { id: user.id, email: user.email, displayName: user.displayName }, token });
});

app.get("/api/memory", (c) => {
  const userId = c.req.query("user_id");
  if (!userId) return c.json({ ok: false, error: "user_id_required" }, 400);
  return c.json({ ok: true, memories: repository.listMemoriesForUser(userId) });
});

app.post(
  "/api/memory",
  zValidator(
    "json",
    z.object({
      userId: z.string().min(1),
      memoryType: z.string().min(1),
      key: z.string().min(1),
      value: z.string().min(1),
      confirmed: z.boolean().default(false),
      confidence: z.number().min(0).max(1).default(1)
    })
  ),
  (c) => {
    const body = c.req.valid("json");
    const memory = repository.createMemory(body);
    return c.json({ ok: true, memory }, 201);
  }
);

app.post("/api/assistant/message", zValidator("json", assistantRequestSchema), (c) => {
  const body = c.req.valid("json");
  return c.json(handleAssistantMessage(body));
});

app.get("/api/voice/voices", (c) => c.json({ ok: true, voices: listVoices() }));

app.get("/api/voice/settings", (c) => {
  const userId = c.req.query("user_id");
  if (!userId) return c.json({ ok: false, error: "user_id_required" }, 400);
  return c.json({ ok: true, settings: repository.getVoiceSettings(userId) ?? null });
});

app.put("/api/voice/settings", zValidator("json", voiceSettingsSchema), (c) => {
  const settings = c.req.valid("json");
  return c.json({ ok: true, settings: repository.setVoiceSettings(settings.userId, settings) });
});

app.post(
  "/api/voice/speak",
  zValidator(
    "json",
    z.object({
      text: z.string().min(1).max(4000),
      user_id: z.string().min(1),
      voice_id: z.string().default("xion_voice_1"),
      language: z.string().default("es-CL"),
      speed: z.number().min(0.5).max(2).default(1)
    })
  ),
  (c) => {
    const body = c.req.valid("json");
    return c.json({
      ok: true,
      ...synthesizeSpeech({
        text: body.text,
        userId: body.user_id,
        voiceId: body.voice_id,
        language: body.language,
        speed: body.speed
      })
    });
  }
);

app.post("/api/voice/transcribe", () =>
  new Response(JSON.stringify({ ok: false, error: "stt_provider_not_configured_in_v0.0.1" }), {
    status: 501,
    headers: { "content-type": "application/json" }
  })
);

app.get("/api/updates/latest", (c) => {
  const platform = c.req.query("platform");
  const channel = c.req.query("channel") ?? "stable";
  const arch = c.req.query("arch") ?? (platform === "windows" ? "x64" : undefined);
  const apiBase = c.env.PUBLIC_API_URL || "https://api.asst.xion.example.com";
  const manifest = {
    version: "0.0.1",
    platform,
    arch,
    channel,
    download_url:
      platform === "android"
        ? `${apiBase}/releases/mobile/android/xion-assistant-0.0.1.apk`
        : `${apiBase}/releases/desktop/windows/xion-assistant-setup-0.0.1.exe`,
    sha256: "0".repeat(64),
    size: 1,
    changelog: "Initial v0.0.1 foundation manifest. Real artifacts must be uploaded to R2 before release.",
    required: false,
    min_supported_version: "0.0.1",
    published_at: "2026-06-28T00:00:00.000Z"
  };

  if (platform !== "windows" && platform !== "android") {
    return c.json({ ok: false, error: "platform_must_be_windows_or_android" }, 400);
  }

  return c.json({ ok: true, manifest: updateManifestSchema.parse(manifest) });
});

export default app;
