import { zValidator } from "@hono/zod-validator";
import { assistantRequestSchema, updateManifestSchema, voiceSettingsSchema } from "@xion-assistant/shared";
import { listVoices, synthesizeSpeech } from "@xion-assistant/voice";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { handleAssistantMessage } from "./services/assistant-engine";
import { createRepository } from "./services/repositories";
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
    version: "0.2.0",
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
  const repository = createRepository(c.env.DB);
  const user = await repository.createUser({
    email: body.email,
    displayName: body.displayName ?? body.email.split("@")[0] ?? "User",
    passwordHash
  });
  const token = await createSessionToken(user.id, c.env.JWT_SECRET);
  const tokenHash = await hashPassword(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  const session = await repository.createSession({ userId: user.id, tokenHash, expiresAt });
  return c.json({
    ok: true,
    user: { id: user.id, email: user.email, displayName: user.displayName },
    token,
    session: { id: session.id, expiresAt: session.expiresAt }
  });
});

app.post("/api/auth/login", zValidator("json", authSchema.omit({ displayName: true })), async (c) => {
  const body = c.req.valid("json");
  const repository = createRepository(c.env.DB);
  const user = await repository.findUserByEmail(body.email);
  if (!user?.passwordHash || !(await verifyPassword(body.password, user.passwordHash))) {
    return c.json({ ok: false, error: "invalid_credentials" }, 401);
  }
  const token = await createSessionToken(user.id, c.env.JWT_SECRET);
  const tokenHash = await hashPassword(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  const session = await repository.createSession({ userId: user.id, tokenHash, expiresAt });
  return c.json({
    ok: true,
    user: { id: user.id, email: user.email, displayName: user.displayName },
    token,
    session: { id: session.id, expiresAt: session.expiresAt }
  });
});

app.get("/api/memory", async (c) => {
  const userId = c.req.query("user_id");
  if (!userId) return c.json({ ok: false, error: "user_id_required" }, 400);
  const repository = createRepository(c.env.DB);
  return c.json({ ok: true, memories: await repository.listMemoriesForUser(userId) });
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
  async (c) => {
    const body = c.req.valid("json");
    const repository = createRepository(c.env.DB);
    const memory = await repository.createMemory(body);
    return c.json({ ok: true, memory }, 201);
  }
);

app.put(
  "/api/memory/:id",
  zValidator(
    "json",
    z.object({
      userId: z.string().min(1),
      key: z.string().min(1).optional(),
      value: z.string().min(1).optional(),
      confirmed: z.boolean().optional(),
      confidence: z.number().min(0).max(1).optional()
    })
  ),
  async (c) => {
    const body = c.req.valid("json");
    const repository = createRepository(c.env.DB);
    const patch: {
      key?: string;
      value?: string;
      confirmed?: boolean;
      confidence?: number;
    } = {};
    if (body.key !== undefined) patch.key = body.key;
    if (body.value !== undefined) patch.value = body.value;
    if (body.confirmed !== undefined) patch.confirmed = body.confirmed;
    if (body.confidence !== undefined) patch.confidence = body.confidence;
    const memory = await repository.updateMemory(body.userId, c.req.param("id"), patch);
    if (!memory) return c.json({ ok: false, error: "memory_not_found" }, 404);
    return c.json({ ok: true, memory });
  }
);

app.delete("/api/memory/:id", async (c) => {
  const userId = c.req.query("user_id");
  if (!userId) return c.json({ ok: false, error: "user_id_required" }, 400);
  const repository = createRepository(c.env.DB);
  const deleted = await repository.deleteMemory(userId, c.req.param("id"));
  if (!deleted) return c.json({ ok: false, error: "memory_not_found" }, 404);
  return c.json({ ok: true, deleted: true });
});

app.post("/api/assistant/message", zValidator("json", assistantRequestSchema), async (c) => {
  const body = c.req.valid("json");
  const repository = createRepository(c.env.DB);
  return c.json(await handleAssistantMessage(repository, body));
});

app.get("/api/actions/:id", async (c) => {
  const userId = c.req.query("user_id");
  if (!userId) return c.json({ ok: false, error: "user_id_required" }, 400);
  const repository = createRepository(c.env.DB);
  const action = await repository.getActionForUser(userId, c.req.param("id"));
  if (!action) return c.json({ ok: false, error: "action_not_found" }, 404);
  return c.json({ ok: true, action });
});

app.post(
  "/api/actions/:id/confirm",
  zValidator(
    "json",
    z.object({
      userId: z.string().min(1),
      payload: z.record(z.unknown()).optional()
    })
  ),
  async (c) => {
    const body = c.req.valid("json");
    const repository = createRepository(c.env.DB);
    const action = await repository.getActionForUser(body.userId, c.req.param("id"));
    if (!action) return c.json({ ok: false, error: "action_not_found" }, 404);
    if (action.status !== "pending_confirmation") {
      return c.json({ ok: false, error: "action_not_pending_confirmation" }, 409);
    }
    const confirmation = await repository.createActionConfirmation({
      userId: body.userId,
      actionId: action.id,
      decision: "confirmed",
      confirmedPayloadJson: JSON.stringify(body.payload ?? JSON.parse(action.inputJson))
    });
    const updated = await repository.updateActionStatus(
      body.userId,
      action.id,
      "failed",
      JSON.stringify({ confirmationRecorded: true, execution: "connector_not_configured" })
    );
    return c.json({ ok: true, confirmation, action: updated });
  }
);

app.post(
  "/api/actions/:id/cancel",
  zValidator("json", z.object({ userId: z.string().min(1) })),
  async (c) => {
    const body = c.req.valid("json");
    const repository = createRepository(c.env.DB);
    const action = await repository.getActionForUser(body.userId, c.req.param("id"));
    if (!action) return c.json({ ok: false, error: "action_not_found" }, 404);
    const confirmation = await repository.createActionConfirmation({
      userId: body.userId,
      actionId: action.id,
      decision: "cancelled"
    });
    const updated = await repository.updateActionStatus(body.userId, action.id, "cancelled");
    return c.json({ ok: true, confirmation, action: updated });
  }
);

app.get("/api/plans/:id", async (c) => {
  const userId = c.req.query("user_id");
  if (!userId) return c.json({ ok: false, error: "user_id_required" }, 400);
  const repository = createRepository(c.env.DB);
  const plan = await repository.getPlanForUser(userId, c.req.param("id"));
  if (!plan) return c.json({ ok: false, error: "plan_not_found" }, 404);
  return c.json({ ok: true, ...plan });
});

app.get("/api/voice/voices", (c) => c.json({ ok: true, voices: listVoices() }));

app.get("/api/voice/settings", async (c) => {
  const userId = c.req.query("user_id");
  if (!userId) return c.json({ ok: false, error: "user_id_required" }, 400);
  const repository = createRepository(c.env.DB);
  return c.json({ ok: true, settings: (await repository.getVoiceSettings(userId)) ?? null });
});

app.put("/api/voice/settings", zValidator("json", voiceSettingsSchema), async (c) => {
  const settings = c.req.valid("json");
  const repository = createRepository(c.env.DB);
  return c.json({ ok: true, settings: await repository.setVoiceSettings(settings.userId, settings) });
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
  new Response(JSON.stringify({ ok: false, error: "stt_provider_not_configured_in_v0.2.0" }), {
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
