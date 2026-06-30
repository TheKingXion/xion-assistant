# Text To Speech

Providers in `v0.11.2`: `mock` and Google Gemini TTS.

## Variables

- `AI_TTS_PROVIDER`
- `AI_TTS_MODEL`
- `AI_TTS_DEFAULT_VOICE`
- `AI_TTS_DEFAULT_LANGUAGE`
- `AI_TTS_DEFAULT_SPEED`

Google Worker example:

```env
AI_TTS_PROVIDER=google
AI_TTS_MODEL=gemini-2.5-flash-preview-tts
AI_TTS_DEFAULT_VOICE=Kore
AI_TTS_DEFAULT_LANGUAGE=es-CL
AI_TTS_DEFAULT_SPEED=1
```

## Voices

- `xion_voice_1`: Spanish Chile neutral mock.
- `xion_voice_2`: Spanish Spain warm mock.
- `Kore`: Google Gemini TTS voice.

## Generate Audio

Frontend calls Worker endpoint:

```text
POST /api/voice/speak
```

Worker calls Google Gemini TTS with `models/{model}:generateContent` and `responseModalities: ["AUDIO"]` when `AI_TTS_PROVIDER=google`.

## Cache And R2

No private audio is stored permanently in `v0.0.1`. Future temp R2 objects must have expiry/cleanup.

## Controls

Speed, pitch, language and volume live in `voice_settings`.

## Costs

Mock provider costs zero. Google cost depends on Gemini billing and must be monitored before wider use.

## Limits

Google TTS returns PCM audio. Worker wraps it as WAV base64 so browser playback can use `data:audio/wav;base64,...`.
