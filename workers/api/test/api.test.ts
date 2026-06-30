import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/index";

const env = {
  PUBLIC_WEB_URL: "http://localhost:5173",
  PUBLIC_API_URL: "http://localhost:8787",
  JWT_SECRET: "local-dev-secret-change-me-32-chars",
  TOKEN_ENCRYPTION_KEY: "local-token-encryption-key-32-chars"
};

const configuredOAuthEnv = {
  ...env,
  GOOGLE_CLIENT_ID: "google-client",
  GOOGLE_CLIENT_SECRET: "google-secret",
  SPOTIFY_CLIENT_ID: "spotify-client",
  SPOTIFY_CLIENT_SECRET: "spotify-secret"
};

const createAuthenticatedUser = async (label: string) => {
  const res = await app.request(
    "/api/auth/register",
    {
      method: "POST",
      body: JSON.stringify({ email: `${label}-${crypto.randomUUID()}@example.com`, password: "change-me-1234", displayName: label }),
      headers: { "content-type": "application/json" }
    },
    env
  );
  const json = (await res.json()) as any;
  return { userId: json.user.id as string, authorization: `Bearer ${json.token}` };
};

afterEach(() => {
  vi.restoreAllMocks();
});

const fakeJwt = (payload: Record<string, unknown>) => {
  const encode = (value: Record<string, unknown>) =>
    btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return `${encode({ alg: "none" })}.${encode(payload)}.sig`;
};

const decodeAuthFragment = (location: string, key: "auth" | "auth_error") => {
  const hash = new URL(location).hash.slice(1);
  const prefix = `${key}=`;
  expect(hash.startsWith(prefix)).toBe(true);
  const value = hash.slice(prefix.length);
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)))) as any;
};

describe("xion assistant api", () => {
  it("returns health with project routes", async () => {
    const res = await app.request("/api/health", {}, env);
    const json = (await res.json()) as any;

    expect(json.ok).toBe(true);
    expect(json.version).toBe("0.12.2");
  });

  it("allows bearer API preflight without credentialed CORS", async () => {
    const res = await app.request("/api/auth/register", { method: "OPTIONS", headers: { origin: "http://localhost:5174", "access-control-request-method": "POST", "access-control-request-headers": "content-type" } }, env);
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-credentials")).toBeNull();
  });

  it("creates persisted session metadata on register", async () => {
    const res = await app.request(
      "/api/auth/register",
      {
        method: "POST",
        body: JSON.stringify({
          email: `user-${crypto.randomUUID()}@example.com`,
          password: "change-me-1234",
          displayName: "Session User"
        }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const json = (await res.json()) as any;

    expect(json.ok).toBe(true);
    expect(json.token).toBeTruthy();
    expect(json.user.isAdmin).toBe(false);
    expect(json.session.id).toMatch(/^ses_/);
  });

  it("rejects duplicate registration and malformed bearer tokens", async () => {
    const email = `duplicate-${crypto.randomUUID()}@example.com`;
    const request = { method: "POST", body: JSON.stringify({ email, password: "change-me-1234" }), headers: { "content-type": "application/json" } };
    expect((await app.request("/api/auth/register", request, env)).status).toBe(200);
    expect((await app.request("/api/auth/register", request, env)).status).toBe(409);
    const malformed = await app.request("/api/commands", { headers: { authorization: "Bearer %%%.???" } }, env);
    expect(malformed.status).toBe(401);
  });

  it("keeps memories isolated by user_id", async () => {
    await app.request(
      "/api/memory",
      {
        method: "POST",
        body: JSON.stringify({
          userId: "user-a",
          memoryType: "contact_alias",
          key: "mi esposa",
          value: "Camila",
          confirmed: true,
          confidence: 1
        }),
        headers: { "content-type": "application/json" }
      },
      env
    );

    const userA = await app.request("/api/memory?user_id=user-a", {}, env);
    const userB = await app.request("/api/memory?user_id=user-b", {}, env);

    expect(((await userA.json()) as any).memories).toHaveLength(1);
    expect(((await userB.json()) as any).memories).toHaveLength(0);
  });

  it("does not execute high risk communication without confirmation", async () => {
    const auth = await createAuthenticatedUser("confirmation-user");
    await app.request(
      "/api/memory",
      {
        method: "POST",
        body: JSON.stringify({ userId: auth.userId, memoryType: "contact_alias", key: "mi esposa", value: "Camila", confirmed: true, confidence: 1 }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const res = await app.request(
      "/api/assistant/message",
      {
        method: "POST",
        body: JSON.stringify({
          message: "Mandale a mi esposa que voy en camino",
          spokenResponse: true
        }),
        headers: { "content-type": "application/json", authorization: auth.authorization }
      },
      env
    );
    const json = (await res.json()) as any;

    expect(json.status).toBe("pending_confirmation");
    expect(json.action.status).toBe("pending_confirmation");
    expect(json.action.riskLevel).toBe("high");
    expect(json.audio.provider).toBe("mock");
  });

  it("persists assistant chat messages for the authenticated user", async () => {
    const auth = await createAuthenticatedUser("chat-history-user");
    const sent = await app.request(
      "/api/assistant/message",
      {
        method: "POST",
        body: JSON.stringify({ message: "Hola Xion", spokenResponse: false }),
        headers: { "content-type": "application/json", authorization: auth.authorization }
      },
      env
    );
    expect(sent.status).toBe(200);

    const history = await app.request("/api/assistant/messages?limit=10", { headers: { authorization: auth.authorization } }, env);
    const json = (await history.json()) as any;

    expect(json.ok).toBe(true);
    expect(json.messages.map((item: any) => item.role)).toEqual(["user", "assistant"]);
    expect(json.messages[0].content).toBe("Hola Xion");
  });

  it("includes recent chat context when generating follow-up replies", async () => {
    const auth = await createAuthenticatedUser("context-user");
    await app.request(
      "/api/assistant/message",
      {
        method: "POST",
        body: JSON.stringify({ message: "Recuerda este dato de la conversacion: mis tokens se reinician a las 3:33", spokenResponse: false }),
        headers: { "content-type": "application/json", authorization: auth.authorization }
      },
      env
    );

    const followUp = await app.request(
      "/api/assistant/message",
      {
        method: "POST",
        body: JSON.stringify({ message: "A que hora se reinician?", spokenResponse: false }),
        headers: { "content-type": "application/json", authorization: auth.authorization }
      },
      env
    );
    const json = (await followUp.json()) as any;

    expect(json.response).toContain("3:33");
  });

  it("transcribes mobile audio with authenticated mock STT", async () => {
    const auth = await createAuthenticatedUser("stt-user");
    const res = await app.request(
      "/api/voice/transcribe",
      {
        method: "POST",
        body: JSON.stringify({ audio_base64: "AAAA", mime_type: "audio/mp4", language: "es-CL" }),
        headers: { "content-type": "application/json", authorization: auth.authorization }
      },
      env
    );
    const json = (await res.json()) as any;

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.text).toContain("Transcripcion mock");
  });

  it("points android update manifest to the current R2 release route", async () => {
    const res = await app.request("/api/updates/latest?platform=android&channel=stable", {}, env);
    const json = (await res.json()) as any;

    expect(json.manifest.version).toBe("0.12.2");
    expect(json.manifest.download_url).toBe("http://localhost:8787/releases/mobile/android/xion-assistant-0.12.2.apk");
  });

  it("blocks admin endpoints for non-admin users", async () => {
    const auth = await createAuthenticatedUser("non-admin");
    const res = await app.request("/api/admin/overview", { headers: { authorization: auth.authorization } }, env);
    const json = (await res.json()) as any;

    expect(res.status).toBe(403);
    expect(json.error).toBe("admin_required");
  });

  it("resolves contact alias and preferred channel per user", async () => {
    const created = await app.request(
      "/api/contacts",
      {
        method: "POST",
        body: JSON.stringify({
          userId: "contact-owner",
          displayName: "Camila"
        }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const contact = ((await created.json()) as any).contact;

    await app.request(
      `/api/contacts/${contact.id}/aliases`,
      {
        method: "POST",
        body: JSON.stringify({ userId: "contact-owner", alias: "mi esposa", confirmed: true }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    await app.request(
      `/api/contacts/${contact.id}/channels`,
      {
        method: "POST",
        body: JSON.stringify({
          userId: "contact-owner",
          channel: "whatsapp",
          address: "+56911111111",
          isPreferred: true
        }),
        headers: { "content-type": "application/json" }
      },
      env
    );

    const ownResolve = await app.request("/api/contacts/resolve?user_id=contact-owner&q=mi%20esposa", {}, env);
    const otherResolve = await app.request("/api/contacts/resolve?user_id=other-contact-user&q=mi%20esposa", {}, env);

    const ownJson = (await ownResolve.json()) as any;
    expect(ownJson.resolved.contact.displayName).toBe("Camila");
    expect(ownJson.resolved.preferredChannel.channel).toBe("whatsapp");
    expect(otherResolve.status).toBe(404);
  });

  it("assistant uses contact alias and preferred channel before memory fallback", async () => {
    const auth = await createAuthenticatedUser("router-user");
    const created = await app.request(
      "/api/contacts",
      {
        method: "POST",
        body: JSON.stringify({ userId: auth.userId, displayName: "Camila Router" }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const contact = ((await created.json()) as any).contact;
    await app.request(
      `/api/contacts/${contact.id}/aliases`,
      {
        method: "POST",
        body: JSON.stringify({ userId: auth.userId, alias: "mi esposa", confirmed: true }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    await app.request(
      `/api/contacts/${contact.id}/channels`,
      {
        method: "POST",
        body: JSON.stringify({
          userId: auth.userId,
          channel: "whatsapp",
          address: "+56922222222",
          isPreferred: true
        }),
        headers: { "content-type": "application/json" }
      },
      env
    );

    const message = await app.request(
      "/api/assistant/message",
      {
        method: "POST",
        body: JSON.stringify({
          message: "Mandale a mi esposa que voy llegando",
          spokenResponse: false
        }),
        headers: { "content-type": "application/json", authorization: auth.authorization }
      },
      env
    );
    const json = (await message.json()) as any;
    const action = await app.request(`/api/actions/${json.action.id}?user_id=${auth.userId}`, {}, env);
    const actionJson = (await action.json()) as any;
    const payload = JSON.parse(actionJson.action.inputJson);

    expect(json.response).toContain("Camila Router");
    expect(json.response).toContain("whatsapp");
    expect(payload.channel).toBe("whatsapp");
    expect(payload.address).toBe("+56922222222");
    expect(json.usedAiFallback).toBe(false);
  });

  it("classifies high risk communication with AI gateway mock", async () => {
    const res = await app.request(
      "/api/assistant/classify",
      {
        method: "POST",
        body: JSON.stringify({ userId: "ai-user", message: "Mandale a mi esposa que llego tarde" }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const json = (await res.json()) as any;

    expect(json.ok).toBe(true);
    expect(json.result.intent).toBe("communication.send_message");
    expect(json.result.riskLevel).toBe("high");
    expect(json.result.entities.recipient).toBe("mi esposa");
    expect(json.result.usage.provider).toBe("mock");
  });

  it("creates mock assistant plans through AI gateway", async () => {
    const res = await app.request(
      "/api/assistant/plan",
      {
        method: "POST",
        body: JSON.stringify({ userId: "plan-user", goal: "Organiza mi dia" }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const json = (await res.json()) as any;

    expect(json.ok).toBe(true);
    expect(json.plan.steps.length).toBeGreaterThan(1);
    expect(json.usage.model).toBe("mock-assistant");
  });

  it("exposes tool registry with confirmation metadata", async () => {
    const res = await app.request("/api/tools/communication.send_message", {}, env);
    const json = (await res.json()) as any;

    expect(json.ok).toBe(true);
    expect(json.tool.riskLevel).toBe("high");
    expect(json.tool.requiresConfirmation).toBe(true);
  });

  it("builds oauth authorization urls without exposing client secrets", async () => {
    const res = await app.request("/api/oauth/google/start?user_id=oauth-user", {}, env);
    const json = (await res.json()) as any;

    expect(json.ok).toBe(true);
    expect(json.authorizationUrl).toContain("accounts.google.com");
    expect(json.authorizationUrl).toContain("state=");
    expect(json.authorizationUrl).not.toContain("secret");
    expect(json.configured).toBe(false);
  });

  it("builds google login authorization url with minimal auth scopes", async () => {
    const res = await app.request("/api/auth/google/start", {}, configuredOAuthEnv);
    const json = (await res.json()) as any;
    const authorizationUrl = new URL(json.authorizationUrl);

    expect(json.ok).toBe(true);
    expect(json.configured).toBe(true);
    expect(json.redirectUri).toBe("http://localhost:8787/api/auth/google/callback");
    expect(authorizationUrl.searchParams.get("scope")).toBe("openid email profile");
    expect(json.authorizationUrl).not.toContain("google-secret");
  });

  it("logs in or registers with google callback and redirects auth payload to web hash", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            access_token: "google-login-access",
            refresh_token: "google-login-refresh",
            expires_in: 3600,
            scope: "openid email profile",
            id_token: fakeJwt({ sub: "google-login-user", email: "google-login@example.com", name: "Google Login" })
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );
    const start = await app.request("/api/auth/google/start", {}, configuredOAuthEnv);
    const startJson = (await start.json()) as any;
    const callback = await app.request(`/api/auth/google/callback?code=auth-code&state=${encodeURIComponent(startJson.state)}`, {}, configuredOAuthEnv);
    const location = callback.headers.get("location") ?? "";
    const auth = decodeAuthFragment(location, "auth");

    expect(callback.status).toBe(302);
    expect(location).toContain("http://localhost:5173/#auth=");
    expect(auth.token).toBeTruthy();
    expect(auth.user.email).toBe("google-login@example.com");
    expect(auth.user.displayName).toBe("Google Login");
    expect(auth.session.id).toMatch(/^ses_/);
    expect(location).not.toContain("google-login-access");
    expect(location).not.toContain("google-login-refresh");
  });

  it("stores oauth accounts redacted and isolated by user", async () => {
    const stored = await app.request(
      "/api/oauth/google/token",
      {
        method: "POST",
        body: JSON.stringify({
          userId: "oauth-owner",
          providerUserId: "google-123",
          accessToken: "access-secret",
          refreshToken: "refresh-secret",
          scopes: ["calendar"]
        }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const storedJson = (await stored.json()) as any;
    const owner = await app.request("/api/oauth/accounts?user_id=oauth-owner", {}, env);
    const other = await app.request("/api/oauth/accounts?user_id=oauth-other", {}, env);
    const ownerJson = (await owner.json()) as any;
    const otherJson = (await other.json()) as any;

    expect(storedJson.ok).toBe(true);
    expect(JSON.stringify(storedJson)).not.toContain("access-secret");
    expect(ownerJson.accounts).toHaveLength(1);
    expect(otherJson.accounts).toHaveLength(0);
  });

  it("disconnects oauth accounts by provider and owner", async () => {
    await app.request(
      "/api/oauth/spotify/token",
      {
        method: "POST",
        body: JSON.stringify({
          userId: "oauth-disconnect",
          providerUserId: "spotify-123",
          accessToken: "spotify-secret",
          scopes: ["playback"]
        }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const deleted = await app.request("/api/oauth/spotify?user_id=oauth-disconnect", { method: "DELETE" }, env);
    const listed = await app.request("/api/oauth/accounts?user_id=oauth-disconnect", {}, env);

    expect(((await deleted.json()) as any).disconnected).toBe(true);
    expect(((await listed.json()) as any).accounts).toHaveLength(0);
  });

  it("exchanges google oauth callback, encrypts tokens, and returns redacted account", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            access_token: "google-access-token",
            refresh_token: "google-refresh-token",
            expires_in: 3600,
            scope: "openid email",
            id_token: fakeJwt({ sub: "google-user-1" })
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    );
    const start = await app.request("/api/oauth/google/start?user_id=oauth-callback-user", {}, configuredOAuthEnv);
    const startJson = (await start.json()) as any;
    const callback = await app.request(`/api/oauth/google/callback?code=auth-code&state=${encodeURIComponent(startJson.state)}`, {}, configuredOAuthEnv);
    const callbackJson = (await callback.json()) as any;

    expect(callbackJson.ok).toBe(true);
    expect(callbackJson.account.providerUserId).toBe("google-user-1");
    expect(JSON.stringify(callbackJson)).not.toContain("google-access-token");
    expect(JSON.stringify(callbackJson)).not.toContain("google-refresh-token");
  });

  it("returns explicit error when oauth callback provider secrets are missing", async () => {
    const start = await app.request("/api/oauth/google/start?user_id=oauth-missing-config", {}, env);
    const startJson = (await start.json()) as any;
    const callback = await app.request(`/api/oauth/google/callback?code=auth-code&state=${encodeURIComponent(startJson.state)}`, {}, env);
    const callbackJson = (await callback.json()) as any;

    expect(callback.status).toBe(501);
    expect(callbackJson.error).toBe("oauth_provider_not_configured");
  });

  it("lists google calendar events with decrypted oauth token", async () => {
    await app.request(
      "/api/oauth/google/token",
      {
        method: "POST",
        body: JSON.stringify({
          userId: "calendar-list-user",
          providerUserId: "google-calendar-user",
          accessToken: "calendar-access-token",
          scopes: ["https://www.googleapis.com/auth/calendar.events"]
        }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toContain("calendar/v3/calendars/primary/events");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer calendar-access-token");
      return new Response(JSON.stringify({ items: [{ id: "evt-1", summary: "Demo" }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await app.request("/api/google/calendar/events?user_id=calendar-list-user", {}, env);
    const json = (await res.json()) as any;

    expect(json.ok).toBe(true);
    expect(json.events[0].id).toBe("evt-1");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("prepares calendar create action and executes only after confirmation", async () => {
    await app.request(
      "/api/oauth/google/token",
      {
        method: "POST",
        body: JSON.stringify({
          userId: "calendar-create-user",
          providerUserId: "google-calendar-create-user",
          accessToken: "calendar-create-token",
          scopes: ["https://www.googleapis.com/auth/calendar.events"]
        }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer calendar-create-token");
      return new Response(JSON.stringify({ id: "created-event", summary: "Reunion" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const prepared = await app.request(
      "/api/google/calendar/events",
      {
        method: "POST",
        body: JSON.stringify({
          userId: "calendar-create-user",
          summary: "Reunion",
          start: "2026-06-29T10:00:00-04:00",
          end: "2026-06-29T11:00:00-04:00"
        }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const preparedJson = (await prepared.json()) as any;
    expect(preparedJson.action.status).toBe("pending_confirmation");
    expect(fetchMock).not.toHaveBeenCalled();

    const confirmed = await app.request(
      `/api/actions/${preparedJson.action.id}/confirm`,
      {
        method: "POST",
        body: JSON.stringify({ userId: "calendar-create-user" }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const confirmedJson = (await confirmed.json()) as any;
    expect(confirmedJson.action.status).toBe("completed");
    expect(JSON.parse(confirmedJson.action.resultJson).event.id).toBe("created-event");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("reads spotify playback with decrypted oauth token", async () => {
    await app.request(
      "/api/oauth/spotify/token",
      {
        method: "POST",
        body: JSON.stringify({
          userId: "spotify-playback-user",
          providerUserId: "spotify-playback-id",
          accessToken: "spotify-playback-token",
          scopes: ["user-read-playback-state"]
        }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://api.spotify.com/v1/me/player");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer spotify-playback-token");
      return new Response(JSON.stringify({ is_playing: true, item: { name: "Tema" } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await app.request("/api/spotify/player?user_id=spotify-playback-user", {}, env);
    const json = (await res.json()) as any;

    expect(json.ok).toBe(true);
    expect(json.playback.is_playing).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("prepares spotify play action and executes only after confirmation", async () => {
    await app.request(
      "/api/oauth/spotify/token",
      {
        method: "POST",
        body: JSON.stringify({
          userId: "spotify-play-user",
          providerUserId: "spotify-play-id",
          accessToken: "spotify-play-token",
          scopes: ["user-modify-playback-state"]
        }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toContain("https://api.spotify.com/v1/me/player/play");
      expect(String(url)).toContain("device_id=device-1");
      expect(init?.method).toBe("PUT");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer spotify-play-token");
      expect(JSON.parse(String(init?.body)).uris[0]).toBe("spotify:track:1");
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const prepared = await app.request(
      "/api/spotify/player/play",
      {
        method: "POST",
        body: JSON.stringify({
          userId: "spotify-play-user",
          deviceId: "device-1",
          uris: ["spotify:track:1"]
        }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const preparedJson = (await prepared.json()) as any;
    expect(preparedJson.action.status).toBe("pending_confirmation");
    expect(fetchMock).not.toHaveBeenCalled();

    const confirmed = await app.request(
      `/api/actions/${preparedJson.action.id}/confirm`,
      {
        method: "POST",
        body: JSON.stringify({ userId: "spotify-play-user" }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const confirmedJson = (await confirmed.json()) as any;
    expect(confirmedJson.action.status).toBe("completed");
    expect(JSON.parse(confirmedJson.action.resultJson).status).toBe("spotify_play_started");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("prepares spotify pause action and executes only after confirmation", async () => {
    await app.request(
      "/api/oauth/spotify/token",
      {
        method: "POST",
        body: JSON.stringify({
          userId: "spotify-pause-user",
          providerUserId: "spotify-pause-id",
          accessToken: "spotify-pause-token",
          scopes: ["user-modify-playback-state"]
        }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toContain("https://api.spotify.com/v1/me/player/pause");
      expect(init?.method).toBe("PUT");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer spotify-pause-token");
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const prepared = await app.request(
      "/api/spotify/player/pause",
      {
        method: "POST",
        body: JSON.stringify({ userId: "spotify-pause-user" }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const preparedJson = (await prepared.json()) as any;
    expect(fetchMock).not.toHaveBeenCalled();

    const confirmed = await app.request(
      `/api/actions/${preparedJson.action.id}/confirm`,
      {
        method: "POST",
        body: JSON.stringify({ userId: "spotify-pause-user" }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const confirmedJson = (await confirmed.json()) as any;
    expect(confirmedJson.action.status).toBe("completed");
    expect(JSON.parse(confirmedJson.action.resultJson).status).toBe("spotify_paused");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("searches youtube with decrypted google oauth token", async () => {
    await app.request(
      "/api/oauth/google/token",
      {
        method: "POST",
        body: JSON.stringify({
          userId: "youtube-search-user",
          providerUserId: "google-youtube-search-user",
          accessToken: "youtube-search-token",
          scopes: ["https://www.googleapis.com/auth/youtube.readonly"]
        }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const requestUrl = new URL(String(url));
      expect(requestUrl.pathname).toBe("/youtube/v3/search");
      expect(requestUrl.searchParams.get("q")).toBe("xion");
      expect(requestUrl.searchParams.get("type")).toBe("video");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer youtube-search-token");
      return new Response(JSON.stringify({ items: [{ id: { videoId: "vid-1" }, snippet: { title: "Xion" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await app.request("/api/google/youtube/search?user_id=youtube-search-user&q=xion", {}, env);
    const json = (await res.json()) as any;

    expect(json.ok).toBe(true);
    expect(json.items[0].id.videoId).toBe("vid-1");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("lists youtube subscriptions with decrypted google oauth token", async () => {
    await app.request(
      "/api/oauth/google/token",
      {
        method: "POST",
        body: JSON.stringify({
          userId: "youtube-sub-user",
          providerUserId: "google-youtube-sub-user",
          accessToken: "youtube-sub-token",
          scopes: ["https://www.googleapis.com/auth/youtube.readonly"]
        }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const requestUrl = new URL(String(url));
      expect(requestUrl.pathname).toBe("/youtube/v3/subscriptions");
      expect(requestUrl.searchParams.get("mine")).toBe("true");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer youtube-sub-token");
      return new Response(JSON.stringify({ items: [{ id: "sub-1", snippet: { title: "Canal" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await app.request("/api/google/youtube/subscriptions?user_id=youtube-sub-user", {}, env);
    const json = (await res.json()) as any;

    expect(json.ok).toBe(true);
    expect(json.subscriptions[0].id).toBe("sub-1");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("records confirmation but does not fake connector execution", async () => {
    const auth = await createAuthenticatedUser("unconfigured-send");
    await app.request("/api/memory", { method: "POST", body: JSON.stringify({ userId: auth.userId, memoryType: "contact_alias", key: "mi esposa", value: "Camila", confirmed: true, confidence: 1 }), headers: { "content-type": "application/json" } }, env);
    const message = await app.request(
      "/api/assistant/message",
      {
        method: "POST",
        body: JSON.stringify({
          message: "Mandale a mi esposa que llego tarde",
          spokenResponse: false
        }),
        headers: { "content-type": "application/json", authorization: auth.authorization }
      },
      env
    );
    const messageJson = (await message.json()) as any;

    const confirm = await app.request(
      `/api/actions/${messageJson.action.id}/confirm`,
      {
        method: "POST",
        body: JSON.stringify({ userId: auth.userId }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const confirmJson = (await confirm.json()) as any;

    expect(confirmJson.ok).toBe(true);
    expect(confirmJson.confirmation.decision).toBe("confirmed");
    expect(confirmJson.action.status).toBe("failed");
    expect(JSON.parse(confirmJson.action.resultJson).execution).toBe("connector_not_configured");
  });

  it("stores assistant plans under the requesting user", async () => {
    const auth = await createAuthenticatedUser("plan-owner");
    await app.request("/api/memory", { method: "POST", body: JSON.stringify({ userId: auth.userId, memoryType: "contact_alias", key: "mi esposa", value: "Camila", confirmed: true, confidence: 1 }), headers: { "content-type": "application/json" } }, env);
    const message = await app.request(
      "/api/assistant/message",
      {
        method: "POST",
        body: JSON.stringify({
          message: "Mandale a mi esposa que voy saliendo",
          spokenResponse: false
        }),
        headers: { "content-type": "application/json", authorization: auth.authorization }
      },
      env
    );
    const messageJson = (await message.json()) as any;

    const ownPlan = await app.request(`/api/plans/${messageJson.plan.id}?user_id=${auth.userId}`, {}, env);
    const otherPlan = await app.request(`/api/plans/${messageJson.plan.id}?user_id=other-user`, {}, env);

    expect(((await ownPlan.json()) as any).plan.id).toBe(messageJson.plan.id);
    expect(otherPlan.status).toBe(404);
  });

  it("updates and deletes memory only for owning user", async () => {
    const created = await app.request(
      "/api/memory",
      {
        method: "POST",
        body: JSON.stringify({
          userId: "memory-owner",
          memoryType: "user_preference",
          key: "idioma",
          value: "es-CL",
          confirmed: true,
          confidence: 1
        }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const createdJson = (await created.json()) as any;

    const denied = await app.request(
      `/api/memory/${createdJson.memory.id}`,
      {
        method: "PUT",
        body: JSON.stringify({ userId: "other-user", value: "en-US" }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const updated = await app.request(
      `/api/memory/${createdJson.memory.id}`,
      {
        method: "PUT",
        body: JSON.stringify({ userId: "memory-owner", value: "es-ES" }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const deleted = await app.request(`/api/memory/${createdJson.memory.id}?user_id=memory-owner`, { method: "DELETE" }, env);

    expect(denied.status).toBe(404);
    expect(((await updated.json()) as any).memory.value).toBe("es-ES");
    expect(((await deleted.json()) as any).deleted).toBe(true);
  });

  it("keeps voice settings isolated by user_id", async () => {
    await app.request(
      "/api/voice/settings",
      {
        method: "PUT",
        body: JSON.stringify({
          userId: "user-a",
          ttsEnabled: true,
          sttEnabled: true,
          wakeWordEnabled: false,
          selectedVoiceId: "xion_voice_1",
          language: "es-CL",
          speed: 1,
          pitch: 1,
          volume: 1,
          autoPlayResponses: true
        }),
        headers: { "content-type": "application/json" }
      },
      env
    );

    const userA = await app.request("/api/voice/settings?user_id=user-a", {}, env);
    const userB = await app.request("/api/voice/settings?user_id=user-b", {}, env);

    expect(((await userA.json()) as any).settings.userId).toBe("user-a");
    expect(((await userB.json()) as any).settings).toBeNull();
  });

  it("returns update manifest for supported platforms", async () => {
    const res = await app.request("/api/updates/latest?platform=android&channel=stable", {}, env);
    const json = (await res.json()) as any;

    expect(json.ok).toBe(true);
    expect(json.manifest.platform).toBe("android");
  });

  it("requires auth for command endpoints", async () => {
    const res = await app.request("/api/commands/shortcuts", {}, env);
    expect(res.status).toBe(401);
    expect(((await res.json()) as any).error).toBe("authentication_required");
  });

  it("prevents one user from editing another user's shortcut", async () => {
    const owner = await createAuthenticatedUser("shortcut-owner");
    const other = await createAuthenticatedUser("shortcut-other");
    const created = await app.request(
      "/api/commands/shortcuts",
      {
        method: "POST",
        headers: { "content-type": "application/json", authorization: owner.authorization },
        body: JSON.stringify({ shortcut: "tempranito", intent: "alarm.create", params: { time: "06:45" } })
      },
      env
    );
    const shortcut = ((await created.json()) as any).shortcut;
    const denied = await app.request(
      `/api/commands/shortcuts/${shortcut.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json", authorization: other.authorization },
        body: JSON.stringify({ params: { time: "08:00" } })
      },
      env
    );
    expect(denied.status).toBe(404);
    const ownerList = await app.request("/api/commands/shortcuts", { headers: { authorization: owner.authorization } }, env);
    expect(((await ownerList.json()) as any).shortcuts[0].params.time).toBe("06:45");
  });
});
