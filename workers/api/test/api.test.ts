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
    expect(json.version).toBe("0.0.1");
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
