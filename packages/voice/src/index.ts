export type Voice = {
  id: string;
  provider: string;
  voiceKey: string;
  displayName: string;
  language: string;
  sampleUrl?: string;
};

export type VoiceSettingsLike = {
  selectedVoiceId: string;
};

export type SpeechResult = {
  audio_url?: string;
  audio_base64?: string;
  format: "mp3" | "wav" | "opus";
  duration: number;
  provider: string;
  voice_id: string;
  cached: boolean;
  created_at: string;
};

const voices: Voice[] = [
  {
    id: "xion_voice_1",
    provider: "mock",
    voiceKey: "es-cl-neutral-1",
    displayName: "Xion Voz 1",
    language: "es-CL"
  },
  {
    id: "xion_voice_2",
    provider: "mock",
    voiceKey: "es-es-warm-1",
    displayName: "Xion Voz 2",
    language: "es-ES"
  }
];

export const listVoices = () => voices;

export const validateVoiceSettings = (settings: VoiceSettingsLike) =>
  voices.some((voice) => voice.id === settings.selectedVoiceId);

export const synthesizeSpeech = (input: {
  text: string;
  userId: string;
  voiceId: string;
  language: string;
  speed: number;
  format?: "mp3" | "wav" | "opus";
}): SpeechResult => {
  const voice = voices.find((item) => item.id === input.voiceId) ?? voices[0];
  if (!voice) {
    throw new Error("No voices configured");
  }
  const encoded = Buffer.from(`mock:${input.userId}:${input.text}`).toString("base64");

  return {
    audio_base64: encoded,
    format: input.format ?? "mp3",
    duration: Math.max(1, Math.ceil(input.text.length / 16 / input.speed)),
    provider: voice.provider,
    voice_id: voice.id,
    cached: false,
    created_at: new Date().toISOString()
  };
};
