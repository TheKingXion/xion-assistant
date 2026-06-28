import { zValidator } from "@hono/zod-validator";
import { assistantRequestSchema, updateManifestSchema, voiceSettingsSchema } from "@xion-assistant/shared";
import { listVoices, synthesizeSpeech } from "@xion-assistant/voice";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { createAiGateway, type AiGatewayConfig } from "./services/ai-gateway";
import { handleAssistantMessage } from "./services/assistant-engine";
import { buildAuthorizationUrl, exchangeOAuthCode, isOAuthProvider, parseOAuthState } from "./services/oauth";
import { createRepository } from "./services/repositories";
import { createSessionToken, encryptToken, hashPassword, verifyPassword } from "./services/security";
import { getTool, listTools } from "./services/tool-registry";
import type { Env } from "./types";

export const app = new Hono<{ Bindings: Env }>();

const aiConfigFromEnv = (env: Env): AiGatewayConfig => {
  const config: AiGatewayConfig = {};
  if (env.AI_PROVIDER !== undefined) config.provider = env.AI_PROVIDER;
  if (env.AI_API_KEY !== undefined) config.apiKey = env.AI_API_KEY;
  if (env.AI_MODEL !== undefined) config.model = env.AI_MODEL;
  if (env.AI_SMALL_MODEL !== undefined) config.smallModel = env.AI_SMALL_MODEL;
  return config;
};

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
    version: "0.6.0",
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

app.get("/api/contacts", async (c) => {
  const userId = c.req.query("user_id");
  if (!userId) return c.json({ ok: false, error: "user_id_required" }, 400);
  const repository = createRepository(c.env.DB);
  return c.json({ ok: true, contacts: await repository.listContactsForUser(userId) });
});

app.post(
  "/api/contacts",
  zValidator(
    "json",
    z.object({
      userId: z.string().min(1),
      displayName: z.string().min(1),
      notes: z.string().optional()
    })
  ),
  async (c) => {
    const body = c.req.valid("json");
    const repository = createRepository(c.env.DB);
    const input: { userId: string; displayName: string; notes?: string } = {
      userId: body.userId,
      displayName: body.displayName
    };
    if (body.notes !== undefined) input.notes = body.notes;
    const contact = await repository.createContact(input);
    return c.json({ ok: true, contact }, 201);
  }
);

app.post(
  "/api/contacts/:id/aliases",
  zValidator(
    "json",
    z.object({
      userId: z.string().min(1),
      alias: z.string().min(1),
      confirmed: z.boolean().default(true)
    })
  ),
  async (c) => {
    const body = c.req.valid("json");
    const repository = createRepository(c.env.DB);
    try {
      const alias = await repository.createContactAlias({
        userId: body.userId,
        contactId: c.req.param("id"),
        alias: body.alias,
        confirmed: body.confirmed
      });
      return c.json({ ok: true, alias }, 201);
    } catch {
      return c.json({ ok: false, error: "contact_not_found" }, 404);
    }
  }
);

app.post(
  "/api/contacts/:id/channels",
  zValidator(
    "json",
    z.object({
      userId: z.string().min(1),
      channel: z.string().min(1),
      address: z.string().min(1),
      isPreferred: z.boolean().default(false)
    })
  ),
  async (c) => {
    const body = c.req.valid("json");
    const repository = createRepository(c.env.DB);
    try {
      const channel = await repository.createContactChannel({
        userId: body.userId,
        contactId: c.req.param("id"),
        channel: body.channel,
        address: body.address,
        isPreferred: body.isPreferred
      });
      return c.json({ ok: true, channel }, 201);
    } catch {
      return c.json({ ok: false, error: "contact_not_found" }, 404);
    }
  }
);

app.get("/api/contacts/resolve", async (c) => {
  const userId = c.req.query("user_id");
  const query = c.req.query("q");
  if (!userId) return c.json({ ok: false, error: "user_id_required" }, 400);
  if (!query) return c.json({ ok: false, error: "q_required" }, 400);
  const repository = createRepository(c.env.DB);
  const resolved = await repository.resolveContact(userId, query);
  if (!resolved) return c.json({ ok: false, error: "contact_not_found" }, 404);
  return c.json({ ok: true, resolved });
});

app.get("/api/oauth/:provider/start", (c) => {
  const provider = c.req.param("provider");
  const userId = c.req.query("user_id");
  const scopes = c.req.queries("scope");
  if (!isOAuthProvider(provider)) return c.json({ ok: false, error: "unsupported_oauth_provider" }, 404);
  if (!userId) return c.json({ ok: false, error: "user_id_required" }, 400);
  const input: { env: Env; provider: typeof provider; userId: string; scopes?: string[] } = {
    env: c.env,
    provider,
    userId
  };
  if (scopes !== undefined) input.scopes = scopes;
  return c.json({
    ok: true,
    provider,
    ...buildAuthorizationUrl(input)
  });
});

app.get("/api/oauth/:provider/callback", async (c) => {
  const provider = c.req.param("provider");
  const code = c.req.query("code");
  const state = c.req.query("state");
  if (!isOAuthProvider(provider)) return c.json({ ok: false, error: "unsupported_oauth_provider" }, 404);
  if (!code) return c.json({ ok: false, error: "oauth_code_required" }, 400);
  if (!state) return c.json({ ok: false, error: "oauth_state_required" }, 400);
  let parsedState: { userId: string; provider: typeof provider };
  try {
    parsedState = parseOAuthState(state);
    if (parsedState.provider !== provider) return c.json({ ok: false, error: "oauth_state_provider_mismatch" }, 400);
  } catch {
    return c.json({ ok: false, error: "invalid_oauth_state" }, 400);
  }
  if (!c.env.TOKEN_ENCRYPTION_KEY) return c.json({ ok: false, error: "token_encryption_key_required" }, 500);
  try {
    const exchanged = await exchangeOAuthCode({
      env: c.env,
      provider,
      code,
      redirectUri: `${c.env.PUBLIC_API_URL}/api/oauth/${provider}/callback`
    });
    const repository = createRepository(c.env.DB);
    const input: {
      userId: string;
      provider: typeof provider;
      providerUserId: string;
      encryptedAccessToken: string;
      encryptedRefreshToken?: string;
      scopes: string[];
      expiresAt?: string;
    } = {
      userId: parsedState.userId,
      provider,
      providerUserId: exchanged.providerUserId,
      encryptedAccessToken: await encryptToken(exchanged.accessToken, c.env.TOKEN_ENCRYPTION_KEY),
      scopes: exchanged.scopes
    };
    if (exchanged.refreshToken !== undefined) {
      input.encryptedRefreshToken = await encryptToken(exchanged.refreshToken, c.env.TOKEN_ENCRYPTION_KEY);
    }
    if (exchanged.expiresAt !== undefined) input.expiresAt = exchanged.expiresAt;
    const account = await repository.upsertOAuthAccount(input);
    return c.json({ ok: true, provider, account });
  } catch (error) {
    const message = error instanceof Error ? error.message : "oauth_exchange_failed";
    const status = message === "oauth_provider_not_configured" ? 501 : 502;
    return c.json({ ok: false, error: message, provider }, status);
  }
});

app.post(
  "/api/oauth/:provider/token",
  zValidator(
    "json",
    z.object({
      userId: z.string().min(1),
      providerUserId: z.string().min(1),
      accessToken: z.string().min(1),
      refreshToken: z.string().optional(),
      scopes: z.array(z.string()).default([]),
      expiresAt: z.string().optional()
    })
  ),
  async (c) => {
    const provider = c.req.param("provider");
    if (!isOAuthProvider(provider)) return c.json({ ok: false, error: "unsupported_oauth_provider" }, 404);
    if (!c.env.TOKEN_ENCRYPTION_KEY) return c.json({ ok: false, error: "token_encryption_key_required" }, 500);
    const body = c.req.valid("json");
    const repository = createRepository(c.env.DB);
    const input: {
      userId: string;
      provider: typeof provider;
      providerUserId: string;
      encryptedAccessToken?: string;
      encryptedRefreshToken?: string;
      scopes: string[];
      expiresAt?: string;
    } = {
      userId: body.userId,
      provider,
      providerUserId: body.providerUserId,
      encryptedAccessToken: await encryptToken(body.accessToken, c.env.TOKEN_ENCRYPTION_KEY),
      scopes: body.scopes
    };
    if (body.refreshToken !== undefined) {
      input.encryptedRefreshToken = await encryptToken(body.refreshToken, c.env.TOKEN_ENCRYPTION_KEY);
    }
    if (body.expiresAt !== undefined) input.expiresAt = body.expiresAt;
    const account = await repository.upsertOAuthAccount(input);
    return c.json({ ok: true, account }, 201);
  }
);

app.get("/api/oauth/accounts", async (c) => {
  const userId = c.req.query("user_id");
  if (!userId) return c.json({ ok: false, error: "user_id_required" }, 400);
  const repository = createRepository(c.env.DB);
  return c.json({ ok: true, accounts: await repository.listOAuthAccountsForUser(userId) });
});

app.delete("/api/oauth/:provider", async (c) => {
  const provider = c.req.param("provider");
  const userId = c.req.query("user_id");
  if (!isOAuthProvider(provider)) return c.json({ ok: false, error: "unsupported_oauth_provider" }, 404);
  if (!userId) return c.json({ ok: false, error: "user_id_required" }, 400);
  const repository = createRepository(c.env.DB);
  const disconnected = await repository.disconnectOAuthAccount(userId, provider);
  if (!disconnected) return c.json({ ok: false, error: "oauth_account_not_found" }, 404);
  return c.json({ ok: true, disconnected: true });
});

app.post("/api/assistant/message", zValidator("json", assistantRequestSchema), async (c) => {
  const body = c.req.valid("json");
  const repository = createRepository(c.env.DB);
  const aiGateway = createAiGateway(aiConfigFromEnv(c.env));
  return c.json(await handleAssistantMessage(repository, aiGateway, body));
});

app.post("/api/assistant/plan", zValidator("json", z.object({ userId: z.string().min(1), goal: z.string().min(1) })), async (c) => {
  const body = c.req.valid("json");
  const aiGateway = createAiGateway(aiConfigFromEnv(c.env));
  const plan = await aiGateway.createActionPlan({ userId: body.userId, goal: body.goal });
  return c.json({ ok: true, ...plan });
});

app.post("/api/assistant/classify", zValidator("json", z.object({ userId: z.string().min(1), message: z.string().min(1) })), async (c) => {
  const body = c.req.valid("json");
  const config = aiConfigFromEnv(c.env);
  if (c.env.AI_SMALL_MODEL !== undefined) config.model = c.env.AI_SMALL_MODEL;
  const aiGateway = createAiGateway(config);
  return c.json({ ok: true, result: await aiGateway.classifyIntent({ userId: body.userId, message: body.message }) });
});

app.get("/api/tools", (c) => c.json({ ok: true, tools: listTools() }));

app.get("/api/tools/:name", (c) => {
  const tool = getTool(c.req.param("name"));
  if (!tool) return c.json({ ok: false, error: "tool_not_found" }, 404);
  return c.json({ ok: true, tool });
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
  new Response(JSON.stringify({ ok: false, error: "stt_provider_not_configured_in_v0.4.0" }), {
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
