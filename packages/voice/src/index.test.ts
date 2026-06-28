import { describe, expect, it } from "vitest";
import { listVoices, synthesizeSpeech } from "./index";

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
});
