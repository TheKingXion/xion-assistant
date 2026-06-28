import { describe, expect, it } from "vitest";
import { mustConfirm, voiceSettingsSchema } from "./index";

describe("shared contracts", () => {
  it("requires explicit confirmation for high risk actions", () => {
    expect(mustConfirm("high")).toBe(true);
    expect(mustConfirm("medium")).toBe(false);
  });

  it("validates voice settings by user", () => {
    const parsed = voiceSettingsSchema.parse({
      userId: "user-a",
      ttsEnabled: true,
      sttEnabled: true,
      wakeWordEnabled: false,
      selectedVoiceId: "xion_voice_1",
      language: "es-CL",
      speed: 1,
      pitch: 1,
      volume: 0.8,
      autoPlayResponses: true
    });

    expect(parsed.userId).toBe("user-a");
  });
});
