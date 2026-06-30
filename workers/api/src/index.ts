import { zValidator } from "@hono/zod-validator";
import { assistantRequestSchema, commandMatchSchema, commandShortcutSchema, updateManifestSchema, voiceSettingsSchema } from "@xion-assistant/shared";
import { listVoices, synthesizeSpeechAsync } from "@xion-assistant/voice";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { createAiGateway, transcribeAudio, type AiGatewayConfig } from "./services/ai-gateway";
import { executeConfirmedAction } from "./services/action-executor";
import { handleAssistantMessage } from "./services/assistant-engine";
import { listGoogleCalendarEvents } from "./services/google-calendar";
import { buildAuthorizationUrl, buildGoogleAuthAuthorizationUrl, exchangeGoogleAuthCode, exchangeOAuthCode, isOAuthProvider, parseGoogleAuthState, parseOAuthState } from "./services/oauth";
import { createRepository } from "./services/repositories";
import { createSessionToken, encryptToken, hashPassword, verifyPassword } from "./services/security";
import { getSpotifyPlayback } from "./services/spotify";
import { getTool, listTools } from "./services/tool-registry";
import { listYouTubeSubscriptions, searchYouTube } from "./services/youtube";
import type { Env } from "./types";
import { requireAuth, type AuthVariables } from "./middleware/auth";
import { commandRegistry, publicCommandDefinition } from "./modules/commands/command-registry";
import { routeCommand } from "./modules/commands/command-router";
import { learnCommandShortcut } from "./modules/commands/learned-commands.service";

export const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

const aiConfigFromEnv = (env: Env): AiGatewayConfig => {
  const config: AiGatewayConfig = {};
  if (env.AI_PROVIDER !== undefined) config.provider = env.AI_PROVIDER;
  if (env.AI_API_KEY !== undefined) config.apiKey = env.AI_API_KEY;
  if (env.AI_MODEL !== undefined) config.model = env.AI_MODEL;
  if (env.AI_SMALL_MODEL !== undefined) config.smallModel = env.AI_SMALL_MODEL;
  if (env.AI_STT_MODEL !== undefined) config.sttModel = env.AI_STT_MODEL;
  return config;
};

const voiceConfigFromEnv = (env: Env) => ({
  provider: env.AI_TTS_PROVIDER,
  apiKey: env.AI_API_KEY,
  model: env.AI_TTS_MODEL,
  defaultVoice: env.AI_TTS_DEFAULT_VOICE ?? "xion_voice_1",
  defaultLanguage: env.AI_TTS_DEFAULT_LANGUAGE ?? "es-CL",
  defaultSpeed: Number(env.AI_TTS_DEFAULT_SPEED ?? "1")
});

app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
  })
);

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    name: "xion-assistant-api",
    version: "0.12.0",
    routes: {
      web: c.env.PUBLIC_WEB_URL,
      api: c.env.PUBLIC_API_URL
    }
  })
);

const RELEASE_VERSION = "0.12.0";

const releaseContentType = (path: string) => {
  if (path.endsWith(".apk")) return "application/vnd.android.package-archive";
  if (path.endsWith(".exe")) return "application/vnd.microsoft.portable-executable";
  if (path.endsWith(".json")) return "application/json; charset=UTF-8";
  if (path.endsWith(".sha256")) return "text/plain; charset=UTF-8";
  return "application/octet-stream";
};

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).optional()
});

const encodeAuthFragment = (value: unknown) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const redirectToWebAuth = (webUrl: string, key: "auth" | "auth_error", value: unknown) => {
  const url = new URL(webUrl || "http://localhost:5173");
  url.hash = `${key}=${encodeAuthFragment(value)}`;
  return url.toString();
};

const publicUser = (user: { id: string; email: string; displayName: string; isAdmin: boolean }) => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  isAdmin: user.isAdmin
});

app.post("/api/auth/register", zValidator("json", authSchema), async (c) => {
  const body = c.req.valid("json");
  const repository = createRepository(c.env.DB);
  if (await repository.findUserByEmail(body.email)) return c.json({ ok: false, error: "email_already_registered" }, 409);
  const passwordHash = await hashPassword(body.password);
  const user = await repository.createUser({
    email: body.email,
    displayName: body.displayName ?? body.email.split("@")[0] ?? "User",
    passwordHash
  });
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  const token = await createSessionToken(user.id, c.env.JWT_SECRET, new Date(expiresAt).getTime());
  const tokenHash = await hashPassword(token);
  const session = await repository.createSession({ userId: user.id, tokenHash, expiresAt });
  return c.json({
    ok: true,
    user: publicUser(user),
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
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  const token = await createSessionToken(user.id, c.env.JWT_SECRET, new Date(expiresAt).getTime());
  const tokenHash = await hashPassword(token);
  const session = await repository.createSession({ userId: user.id, tokenHash, expiresAt });
  return c.json({
    ok: true,
    user: publicUser(user),
    token,
    session: { id: session.id, expiresAt: session.expiresAt }
  });
});

app.use("/api/auth/me", requireAuth);
app.get("/api/auth/me", async (c) => {
  const user = await createRepository(c.env.DB).findUserById(c.get("userId"));
  if (!user) return c.json({ ok: false, error: "user_not_found" }, 404);
  return c.json({ ok: true, user: publicUser(user) });
});

app.get("/api/auth/google/start", (c) =>
  c.json({
    ok: true,
    provider: "google",
    ...buildGoogleAuthAuthorizationUrl(c.env)
  })
);

app.get("/api/auth/google/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  if (!code) return c.redirect(redirectToWebAuth(c.env.PUBLIC_WEB_URL, "auth_error", { error: "oauth_code_required" }), 302);
  if (!state) return c.redirect(redirectToWebAuth(c.env.PUBLIC_WEB_URL, "auth_error", { error: "oauth_state_required" }), 302);
  try {
    parseGoogleAuthState(state);
  } catch {
    return c.redirect(redirectToWebAuth(c.env.PUBLIC_WEB_URL, "auth_error", { error: "invalid_oauth_state" }), 302);
  }
  if (!c.env.TOKEN_ENCRYPTION_KEY) {
    return c.redirect(redirectToWebAuth(c.env.PUBLIC_WEB_URL, "auth_error", { error: "token_encryption_key_required" }), 302);
  }

  try {
    const exchanged = await exchangeGoogleAuthCode({
      env: c.env,
      code,
      redirectUri: `${c.env.PUBLIC_API_URL}/api/auth/google/callback`
    });
    const repository = createRepository(c.env.DB);
    const user = (await repository.findUserByEmail(exchanged.email)) ?? (await repository.createUser({
      email: exchanged.email,
      displayName: exchanged.displayName
    }));
    const accountInput: {
      userId: string;
      provider: "google";
      providerUserId: string;
      encryptedAccessToken: string;
      encryptedRefreshToken?: string;
      scopes: string[];
      expiresAt?: string;
    } = {
      userId: user.id,
      provider: "google",
      providerUserId: exchanged.providerUserId,
      encryptedAccessToken: await encryptToken(exchanged.accessToken, c.env.TOKEN_ENCRYPTION_KEY),
      scopes: exchanged.scopes
    };
    if (exchanged.refreshToken !== undefined) {
      accountInput.encryptedRefreshToken = await encryptToken(exchanged.refreshToken, c.env.TOKEN_ENCRYPTION_KEY);
    }
    if (exchanged.expiresAt !== undefined) accountInput.expiresAt = exchanged.expiresAt;
    await repository.upsertOAuthAccount(accountInput);

    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    const token = await createSessionToken(user.id, c.env.JWT_SECRET, new Date(expiresAt).getTime());
    const tokenHash = await hashPassword(token);
    const session = await repository.createSession({ userId: user.id, tokenHash, expiresAt });
    return c.redirect(
      redirectToWebAuth(c.env.PUBLIC_WEB_URL, "auth", {
        token,
        user: publicUser(user),
        session: { id: session.id, expiresAt: session.expiresAt }
      }),
      302
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "oauth_exchange_failed";
    return c.redirect(redirectToWebAuth(c.env.PUBLIC_WEB_URL, "auth_error", { error: message }), 302);
  }
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

app.get("/api/google/calendar/events", async (c) => {
  const userId = c.req.query("user_id");
  if (!userId) return c.json({ ok: false, error: "user_id_required" }, 400);
  const repository = createRepository(c.env.DB);
  try {
    const input: { userId: string; calendarId?: string; timeMin?: string; maxResults?: number } = { userId };
    const calendarId = c.req.query("calendar_id");
    const timeMin = c.req.query("time_min");
    const maxResults = c.req.query("max_results");
    if (calendarId !== undefined) input.calendarId = calendarId;
    if (timeMin !== undefined) input.timeMin = timeMin;
    if (maxResults !== undefined) input.maxResults = Number(maxResults);
    const events = await listGoogleCalendarEvents(repository, c.env, input);
    return c.json({ ok: true, events });
  } catch (error) {
    const message = error instanceof Error ? error.message : "google_calendar_list_failed";
    const status = message === "google_oauth_not_connected" ? 409 : 502;
    return c.json({ ok: false, error: message }, status);
  }
});

app.post(
  "/api/google/calendar/events",
  zValidator(
    "json",
    z.object({
      userId: z.string().min(1),
      calendarId: z.string().optional(),
      summary: z.string().min(1),
      description: z.string().optional(),
      start: z.string().min(1),
      end: z.string().min(1),
      timeZone: z.string().optional()
    })
  ),
  async (c) => {
    const body = c.req.valid("json");
    const repository = createRepository(c.env.DB);
    const event: {
      summary: string;
      description?: string;
      start: string;
      end: string;
      timeZone?: string;
    } = {
      summary: body.summary,
      start: body.start,
      end: body.end
    };
    if (body.description !== undefined) event.description = body.description;
    if (body.timeZone !== undefined) event.timeZone = body.timeZone;
    const input: { calendarId?: string; event: typeof event } = { event };
    if (body.calendarId !== undefined) input.calendarId = body.calendarId;
    const action = await repository.createAction({
      userId: body.userId,
      toolName: "calendar.create_event",
      riskLevel: "medium",
      status: "pending_confirmation",
      inputJson: JSON.stringify(input)
    });
    return c.json({ ok: true, action }, 201);
  }
);

app.get("/api/spotify/player", async (c) => {
  const userId = c.req.query("user_id");
  if (!userId) return c.json({ ok: false, error: "user_id_required" }, 400);
  const repository = createRepository(c.env.DB);
  try {
    const playback = await getSpotifyPlayback(repository, c.env, { userId });
    return c.json({ ok: true, playback });
  } catch (error) {
    const message = error instanceof Error ? error.message : "spotify_playback_failed";
    const status = message === "spotify_oauth_not_connected" ? 409 : 502;
    return c.json({ ok: false, error: message }, status);
  }
});

app.post(
  "/api/spotify/player/play",
  zValidator(
    "json",
    z.object({
      userId: z.string().min(1),
      deviceId: z.string().optional(),
      contextUri: z.string().optional(),
      uris: z.array(z.string()).optional()
    })
  ),
  async (c) => {
    const body = c.req.valid("json");
    const repository = createRepository(c.env.DB);
    const input: { deviceId?: string; contextUri?: string; uris?: string[] } = {};
    if (body.deviceId !== undefined) input.deviceId = body.deviceId;
    if (body.contextUri !== undefined) input.contextUri = body.contextUri;
    if (body.uris !== undefined) input.uris = body.uris;
    const action = await repository.createAction({
      userId: body.userId,
      toolName: "spotify.play",
      riskLevel: "medium",
      status: "pending_confirmation",
      inputJson: JSON.stringify(input)
    });
    return c.json({ ok: true, action }, 201);
  }
);

app.post(
  "/api/spotify/player/pause",
  zValidator(
    "json",
    z.object({
      userId: z.string().min(1),
      deviceId: z.string().optional()
    })
  ),
  async (c) => {
    const body = c.req.valid("json");
    const repository = createRepository(c.env.DB);
    const input: { deviceId?: string } = {};
    if (body.deviceId !== undefined) input.deviceId = body.deviceId;
    const action = await repository.createAction({
      userId: body.userId,
      toolName: "spotify.pause",
      riskLevel: "medium",
      status: "pending_confirmation",
      inputJson: JSON.stringify(input)
    });
    return c.json({ ok: true, action }, 201);
  }
);

app.get("/api/google/youtube/search", async (c) => {
  const userId = c.req.query("user_id");
  const query = c.req.query("q");
  if (!userId) return c.json({ ok: false, error: "user_id_required" }, 400);
  if (!query) return c.json({ ok: false, error: "q_required" }, 400);
  const repository = createRepository(c.env.DB);
  try {
    const input: { userId: string; query: string; maxResults?: number } = { userId, query };
    const maxResults = c.req.query("max_results");
    if (maxResults !== undefined) input.maxResults = Number(maxResults);
    const items = await searchYouTube(repository, c.env, input);
    return c.json({ ok: true, items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "youtube_search_failed";
    const status = message === "google_oauth_not_connected" ? 409 : 502;
    return c.json({ ok: false, error: message }, status);
  }
});

app.get("/api/google/youtube/subscriptions", async (c) => {
  const userId = c.req.query("user_id");
  if (!userId) return c.json({ ok: false, error: "user_id_required" }, 400);
  const repository = createRepository(c.env.DB);
  try {
    const input: { userId: string; maxResults?: number } = { userId };
    const maxResults = c.req.query("max_results");
    if (maxResults !== undefined) input.maxResults = Number(maxResults);
    const subscriptions = await listYouTubeSubscriptions(repository, c.env, input);
    return c.json({ ok: true, subscriptions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "youtube_subscriptions_failed";
    const status = message === "google_oauth_not_connected" ? 409 : 502;
    return c.json({ ok: false, error: message }, status);
  }
});

app.use("/api/assistant/message", requireAuth);
app.post("/api/assistant/message", zValidator("json", assistantRequestSchema), async (c) => {
  const body = c.req.valid("json");
  const repository = createRepository(c.env.DB);
  const aiGateway = createAiGateway(aiConfigFromEnv(c.env));
  const input = {
    userId: c.get("userId"),
    message: body.message,
    spokenResponse: body.spokenResponse,
    platform: body.platform,
    voice: voiceConfigFromEnv(c.env),
    ...(body.timezone ? { timezone: body.timezone } : {})
  };
  try {
    return c.json(await handleAssistantMessage(repository, aiGateway, input));
  } catch (error) {
    const message = error instanceof Error ? error.message : "assistant_message_failed";
    return c.json({ ok: false, error: message, status: "failed", response: "No pude responder ahora. Revisa configuracion IA/TTS del Worker." }, 502);
  }
});

app.use("/api/assistant/messages", requireAuth);
app.get("/api/assistant/messages", async (c) => {
  const limit = Number(c.req.query("limit") ?? "50");
  const messages = await createRepository(c.env.DB).listAssistantMessages(c.get("userId"), Number.isFinite(limit) ? limit : 50);
  return c.json({ ok: true, messages });
});

app.use("/api/admin/*", requireAuth);
app.get("/api/admin/overview", async (c) => {
  const repository = createRepository(c.env.DB);
  const user = await repository.findUserById(c.get("userId"));
  if (!user?.isAdmin) return c.json({ ok: false, error: "admin_required" }, 403);
  return c.json({ ok: true, user: publicUser(user), message: "admin_access_granted" });
});

app.use("/api/commands", requireAuth);
app.use("/api/commands/*", requireAuth);

app.get("/api/commands", (c) => c.json({ ok: true, commands: commandRegistry.map(publicCommandDefinition) }));

app.get("/api/commands/shortcuts", async (c) => {
  const shortcuts = await createRepository(c.env.DB).listCommandShortcuts(c.get("userId"));
  return c.json({ ok: true, shortcuts: shortcuts.map((item) => ({ ...item, params: JSON.parse(item.paramsJson), paramsJson: undefined })) });
});

app.post("/api/commands/shortcuts", zValidator("json", commandShortcutSchema), async (c) => {
  const body = c.req.valid("json");
  if (!commandRegistry.some((command) => command.name === body.intent)) return c.json({ ok: false, error: "command_not_found" }, 400);
  const shortcut = await createRepository(c.env.DB).createCommandShortcut({
    userId: c.get("userId"), shortcut: body.shortcut, intent: body.intent, paramsJson: JSON.stringify(body.params), confidence: body.confidence, confirmed: body.confirmed, isActive: body.isActive
  });
  return c.json({ ok: true, shortcut: { ...shortcut, params: JSON.parse(shortcut.paramsJson), paramsJson: undefined } }, 201);
});

app.put("/api/commands/shortcuts/:id", zValidator("json", commandShortcutSchema.partial()), async (c) => {
  const body = c.req.valid("json");
  if (body.intent && !commandRegistry.some((command) => command.name === body.intent)) return c.json({ ok: false, error: "command_not_found" }, 400);
  const patch: { shortcut?: string; intent?: string; paramsJson?: string; confidence?: number; confirmed?: boolean; isActive?: boolean } = {};
  if (body.shortcut !== undefined) patch.shortcut = body.shortcut;
  if (body.intent !== undefined) patch.intent = body.intent;
  if (body.params !== undefined) patch.paramsJson = JSON.stringify(body.params);
  if (body.confidence !== undefined) patch.confidence = body.confidence;
  if (body.confirmed !== undefined) patch.confirmed = body.confirmed;
  if (body.isActive !== undefined) patch.isActive = body.isActive;
  const shortcut = await createRepository(c.env.DB).updateCommandShortcut(c.get("userId"), c.req.param("id"), patch);
  if (!shortcut) return c.json({ ok: false, error: "shortcut_not_found" }, 404);
  return c.json({ ok: true, shortcut: { ...shortcut, params: JSON.parse(shortcut.paramsJson), paramsJson: undefined } });
});

app.delete("/api/commands/shortcuts/:id", async (c) => {
  const deleted = await createRepository(c.env.DB).deleteCommandShortcut(c.get("userId"), c.req.param("id"));
  if (!deleted) return c.json({ ok: false, error: "shortcut_not_found" }, 404);
  return c.json({ ok: true, deleted: true });
});

app.post("/api/commands/match", zValidator("json", commandMatchSchema), async (c) => {
  const body = c.req.valid("json");
  const routed = await routeCommand(createRepository(c.env.DB), { userId: c.get("userId"), text: body.text, timezone: body.timezone });
  if (routed.kind === "fallback") return c.json({ matched: false, confidence: routed.match.confidence, params: {}, usedAiFallback: true });
  return c.json(routed.result);
});

app.post("/api/commands/learn", zValidator("json", z.object({ sourceText: z.string().min(1), shortcut: z.string().min(1), intent: z.string().min(1), params: z.record(z.unknown()).default({}), confirmed: z.boolean().default(false) })), async (c) => {
  const body = c.req.valid("json");
  if (!commandRegistry.some((command) => command.name === body.intent)) return c.json({ ok: false, error: "command_not_found" }, 400);
  return c.json({ ok: true, ...(await learnCommandShortcut(createRepository(c.env.DB), { userId: c.get("userId"), ...body })) }, 201);
});

app.get("/api/commands/usage", async (c) => {
  const events = await createRepository(c.env.DB).listCommandUsage(c.get("userId"));
  return c.json({ ok: true, events, totals: { uses: events.filter((item) => !item.usedAiFallback).length, aiFallbacks: events.filter((item) => item.usedAiFallback).length, estimatedTokensSaved: events.reduce((sum, item) => sum + item.estimatedTokensSaved, 0) } });
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
    try {
      const execution = await executeConfirmedAction(repository, c.env, { userId: body.userId, actionId: action.id });
      const updated = await repository.updateActionStatus(
        body.userId,
        action.id,
        execution.status,
        JSON.stringify(execution.result)
      );
      return c.json({ ok: true, confirmation, action: updated });
    } catch (error) {
      const message = error instanceof Error ? error.message : "action_execution_failed";
      const updated = await repository.updateActionStatus(
        body.userId,
        action.id,
        "failed",
        JSON.stringify({ confirmationRecorded: true, execution: message })
      );
      return c.json({ ok: true, confirmation, action: updated });
    }
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
  async (c) => {
    const body = c.req.valid("json");
    return c.json({
      ok: true,
      ...(await synthesizeSpeechAsync({
        text: body.text,
        userId: body.user_id,
        voiceId: body.voice_id,
        language: body.language,
        speed: body.speed,
        provider: c.env.AI_TTS_PROVIDER,
        apiKey: c.env.AI_API_KEY,
        model: c.env.AI_TTS_MODEL
      }))
    });
  }
);

app.use("/api/voice/transcribe", requireAuth);
app.post(
  "/api/voice/transcribe",
  zValidator(
    "json",
    z.object({
      audio_base64: z.string().min(1).max(12_000_000),
      mime_type: z.string().min(3).max(120).default("audio/mp4"),
      language: z.string().min(2).max(16).default("es-CL")
    })
  ),
  async (c) => {
    const body = c.req.valid("json");
    try {
      const result = await transcribeAudio(aiConfigFromEnv(c.env), {
        audioBase64: body.audio_base64,
        mimeType: body.mime_type,
        language: body.language
      });
      return c.json({ ok: true, text: result.text, usage: result.usage });
    } catch (error) {
      const message = error instanceof Error ? error.message : "voice_transcribe_failed";
      return c.json({ ok: false, error: message }, 502);
    }
  }
);

app.get("/releases/*", async (c) => {
  if (!c.env.RELEASES) return c.json({ ok: false, error: "r2_releases_binding_required" }, 500);
  const key = c.req.path.replace(/^\/releases\//, "");
  if (!key || key.includes("..")) return c.json({ ok: false, error: "invalid_release_path" }, 400);
  const object = await c.env.RELEASES.get(key);
  if (!object) return c.json({ ok: false, error: "release_not_found", key }, 404);
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("content-type", headers.get("content-type") ?? releaseContentType(key));
  headers.set("cache-control", key.includes("/latest/") ? "no-store" : "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
});

app.get("/api/updates/latest", async (c) => {
  const platform = c.req.query("platform");
  const channel = c.req.query("channel") ?? "stable";
  const arch = c.req.query("arch") ?? (platform === "windows" ? "x64" : undefined);
  const apiBase = c.env.PUBLIC_API_URL || "https://api.asst.xion.example.com";
  if (platform !== "windows" && platform !== "android") {
    return c.json({ ok: false, error: "platform_must_be_windows_or_android" }, 400);
  }

  if (platform === "android" && c.env.RELEASES) {
    const stored = await c.env.RELEASES.get("mobile/android/latest.json");
    if (stored) {
      const manifest = updateManifestSchema.parse(await stored.json());
      return c.json({ ok: true, manifest });
    }
  }

  const manifest = {
    version: RELEASE_VERSION,
    platform,
    arch,
    channel,
    download_url:
      platform === "android"
        ? `${apiBase}/releases/mobile/android/xion-assistant-${RELEASE_VERSION}.apk`
        : `${apiBase}/releases/desktop/windows/xion-assistant-setup-${RELEASE_VERSION}.exe`,
    sha256: "0".repeat(64),
    size: 1,
    changelog: "Mobile Android app with voice-first chat, TTS playback, STT upload and R2 download route.",
    required: false,
    min_supported_version: "0.12.0",
    published_at: "2026-06-30T00:00:00.000Z"
  };

  return c.json({ ok: true, manifest: updateManifestSchema.parse(manifest) });
});

export default app;
