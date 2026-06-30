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
  },
  {
    id: "Kore",
    provider: "google",
    voiceKey: "Kore",
    displayName: "Kore",
    language: "es-CL"
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
  provider?: string | undefined;
  apiKey?: string | undefined;
  model?: string | undefined;
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

const pcm16ToWavBase64 = (pcmBase64: string, sampleRate = 24000) => {
  const pcm = Buffer.from(pcmBase64, "base64");
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]).toString("base64");
};

export const synthesizeSpeechAsync = async (input: {
  text: string;
  userId: string;
  voiceId: string;
  language: string;
  speed: number;
  format?: "mp3" | "wav" | "opus";
  provider?: string | undefined;
  apiKey?: string | undefined;
  model?: string | undefined;
}): Promise<SpeechResult> => {
  if (input.provider !== "google" || !input.apiKey) return synthesizeSpeech(input);
  const voice = voices.find((item) => item.id === input.voiceId || item.voiceKey === input.voiceId) ?? voices.find((item) => item.id === "Kore") ?? voices[0];
  if (!voice) throw new Error("No voices configured");
  const model = input.model ?? "gemini-2.5-flash-preview-tts";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": input.apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: input.text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice.voiceKey
            }
          }
        }
      }
    })
  });
  if (!response.ok) throw new Error("google_tts_failed");
  const payload = (await response.json()) as {
    output_audio?: { data?: string };
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }>;
  };
  const audioData = payload.output_audio?.data ?? payload.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData?.data;
  if (!audioData) throw new Error("google_tts_empty_response");
  return {
    audio_base64: pcm16ToWavBase64(audioData),
    format: "wav",
    duration: Math.max(1, Math.ceil(input.text.length / 16 / input.speed)),
    provider: "google",
    voice_id: voice.id,
    cached: false,
    created_at: new Date().toISOString()
  };
};
