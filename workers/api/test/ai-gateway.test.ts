import { describe, expect, it, vi } from "vitest";
import { createAiGateway, normalizeTranscriptText } from "../src/services/ai-gateway";

describe("google ai gateway", () => {
  it("uses Google generateContent API when configured", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain("/v1beta/models/gemini-2.5-flash:generateContent");
      expect(new Headers(init?.headers).get("x-goog-api-key")).toBe("secret-key");
      const body = JSON.parse(String(init?.body));
      const prompt = body.contents[0].parts[0].text as string;
      expect(prompt).toContain("Hola");
      expect(prompt).toContain("claro, directo y completo");
      expect(prompt).not.toContain("Maximo 3 frases");
      expect(body.generationConfig.maxOutputTokens).toBe(900);
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Respuesta real" }] } }] }), {
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

  it("normalizes common Heppi transcription mistakes", () => {
    expect(normalizeTranscriptText("los tokens de GPI se reinician")).toContain("Heppi");
    expect(normalizeTranscriptText("abre Kevin")).toBe("abre Heppi");
    expect(normalizeTranscriptText("cuenta de heavy")).toBe("cuenta de Heppi");
  });
});
