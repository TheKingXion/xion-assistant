import { describe, expect, it, vi } from "vitest";
import { createAiGateway } from "../src/services/ai-gateway";

describe("google ai gateway", () => {
  it("uses Google Interactions API when configured", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("x-goog-api-key")).toBe("secret-key");
      expect(JSON.parse(String(init?.body)).model).toBe("gemini-2.5-flash");
      return new Response(JSON.stringify({ output_text: "Respuesta real" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const gateway = createAiGateway({
      provider: "google",
      apiKey: "secret-key",
      model: "gemini-2.5-flash"
    });
    const result = await gateway.generateText({ userId: "user-a", prompt: "Hola" });

    expect(result.text).toBe("Respuesta real");
    expect(result.usage.provider).toBe("google");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
