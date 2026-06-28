# Text To Speech

Provider in `v0.0.1`: `mock`.

## Variables

- `AI_TTS_PROVIDER`
- `AI_TTS_MODEL`
- `AI_TTS_DEFAULT_VOICE`
- `AI_TTS_DEFAULT_LANGUAGE`
- `AI_TTS_DEFAULT_SPEED`

## Voices

- `xion_voice_1`: Spanish Chile neutral mock.
- `xion_voice_2`: Spanish Spain warm mock.

## Test Voice

```bash
curl http://localhost:8787/api/voice/voices
```

## Generate Audio

```bash
curl -X POST http://localhost:8787/api/voice/speak \
  -H "content-type: application/json" \
  -d "{\"text\":\"Hola\",\"user_id\":\"user-a\",\"voice_id\":\"xion_voice_1\"}"
```

## Cache And R2

No private audio is stored permanently in `v0.0.1`. Future temp R2 objects must have expiry/cleanup.

## Controls

Speed, pitch, language and volume live in `voice_settings`.

## Costs

Mock provider costs zero. Real provider cost must be documented before enabling.

## Limits

Mock audio is base64 placeholder, not real speech.
