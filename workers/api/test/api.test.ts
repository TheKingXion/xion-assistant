import { describe, expect, it } from "vitest";
import { app } from "../src/index";

const env = {
  PUBLIC_WEB_URL: "http://localhost:5173",
  PUBLIC_API_URL: "http://localhost:8787",
  JWT_SECRET: "local-dev-secret-change-me-32-chars"
};

describe("xion assistant api", () => {
  it("returns health with project routes", async () => {
    const res = await app.request("/api/health", {}, env);
    const json = (await res.json()) as any;

    expect(json.ok).toBe(true);
    expect(json.version).toBe("0.2.0");
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
