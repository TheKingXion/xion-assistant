import { describe, expect, it, vi } from "vitest";
import { listGoogleVoices, listVoices, synthesizeSpeech, synthesizeSpeechAsync } from "./index";

describe("voice gateway mock", () => {
  it("lists selectable voices", () => {
    expect(listVoices().length).toBeGreaterThan(1);
  });

  it("synthesizes without exposing provider secrets", () => {
    const result = synthesizeSpeech({
      text: "Hola Luis",
      userId: "user-a",
      voiceId: "xion_voice_1",
      language: "es-CL",
      speed: 1
    });

    expect(result.provider).toBe("mock");
    expect(result.audio_base64).toBeTruthy();
  });

  it("synthesizes Google TTS as playable wav base64", async () => {
    const pcm = Buffer.from([0, 0, 1, 0]).toString("base64");
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain("/v1beta/models/gemini-2.5-flash-preview-tts:generateContent");
      expect(new Headers(init?.headers).get("x-goog-api-key")).toBe("secret-key");
      expect(JSON.parse(String(init?.body)).generationConfig.responseModalities).toEqual(["AUDIO"]);
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: pcm, mimeType: "audio/pcm" } }] } }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await synthesizeSpeechAsync({
      text: "Hola",
      userId: "user-a",
      voiceId: "Kore",
      language: "es-CL",
      speed: 1,
      provider: "google",
      apiKey: "secret-key",
      model: "gemini-2.5-flash-preview-tts"
    });

    expect(result.format).toBe("wav");
    expect(Buffer.from(result.audio_base64!, "base64").toString("utf8", 0, 4)).toBe("RIFF");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("lists Google voices from voices:list", async () => {
    const fetchMock = vi.fn(async (url: URL) => {
      expect(String(url)).toContain("https://texttospeech.googleapis.com/v1/voices");
      expect(String(url)).toContain("languageCode=es-CL");
      return new Response(JSON.stringify({ voices: [{ name: "es-CL-Standard-A", languageCodes: ["es-CL"], ssmlGender: "FEMALE", naturalSampleRateHertz: 24000 }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const voices = await listGoogleVoices({ apiKey: "secret-key", languageCode: "es-CL" });

    expect(voices[0]).toMatchObject({ id: "es-CL-Standard-A", provider: "google", language: "es-CL" });
  });
});
