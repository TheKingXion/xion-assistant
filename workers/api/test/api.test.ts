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

afterEach(() => {
  vi.restoreAllMocks();
});

const fakeJwt = (payload: Record<string, unknown>) => {
  const encode = (value: Record<string, unknown>) =>
    btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return `${encode({ alg: "none" })}.${encode(payload)}.sig`;
};

describe("xion assistant api", () => {
  it("returns health with project routes", async () => {
    const res = await app.request("/api/health", {}, env);
    const json = (await res.json()) as any;

    expect(json.ok).toBe(true);
    expect(json.version).toBe("0.6.0");
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
    expect(json.session.id).toMatch(/^ses_/);
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
    const res = await app.request(
      "/api/assistant/message",
      {
        method: "POST",
        body: JSON.stringify({
          userId: "user-a",
          message: "Mandale a mi esposa que voy en camino",
          spokenResponse: true
        }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const json = (await res.json()) as any;

    expect(json.status).toBe("pending_confirmation");
    expect(json.action.status).toBe("pending_confirmation");
    expect(json.action.riskLevel).toBe("high");
    expect(json.audio.provider).toBe("mock");
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
    const created = await app.request(
      "/api/contacts",
      {
        method: "POST",
        body: JSON.stringify({ userId: "router-user", displayName: "Camila Router" }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const contact = ((await created.json()) as any).contact;
    await app.request(
      `/api/contacts/${contact.id}/aliases`,
      {
        method: "POST",
        body: JSON.stringify({ userId: "router-user", alias: "mi esposa", confirmed: true }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    await app.request(
      `/api/contacts/${contact.id}/channels`,
      {
        method: "POST",
        body: JSON.stringify({
          userId: "router-user",
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
          userId: "router-user",
          message: "Mandale a mi esposa que voy llegando",
          spokenResponse: false
        }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const json = (await message.json()) as any;
    const action = await app.request(`/api/actions/${json.action.id}?user_id=router-user`, {}, env);
    const actionJson = (await action.json()) as any;
    const payload = JSON.parse(actionJson.action.inputJson);

    expect(json.response).toContain("Camila Router");
    expect(json.response).toContain("whatsapp");
    expect(payload.channel).toBe("whatsapp");
    expect(payload.address).toBe("+56922222222");
    expect(json.plan.ai.provider).toBe("mock");
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

  it("records confirmation but does not fake connector execution", async () => {
    const message = await app.request(
      "/api/assistant/message",
      {
        method: "POST",
        body: JSON.stringify({
          userId: "user-a",
          message: "Mandale a mi esposa que llego tarde",
          spokenResponse: false
        }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const messageJson = (await message.json()) as any;

    const confirm = await app.request(
      `/api/actions/${messageJson.action.id}/confirm`,
      {
        method: "POST",
        body: JSON.stringify({ userId: "user-a" }),
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
    const message = await app.request(
      "/api/assistant/message",
      {
        method: "POST",
        body: JSON.stringify({
          userId: "user-a",
          message: "Mandale a mi esposa que voy saliendo",
          spokenResponse: false
        }),
        headers: { "content-type": "application/json" }
      },
      env
    );
    const messageJson = (await message.json()) as any;

    const ownPlan = await app.request(`/api/plans/${messageJson.plan.id}?user_id=user-a`, {}, env);
    const otherPlan = await app.request(`/api/plans/${messageJson.plan.id}?user_id=user-b`, {}, env);

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
});
