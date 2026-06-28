# Voice System

`v0.0.1` implements voice contracts, selectable mock voices, per-user settings, and TTS mock. Real STT/TTS providers are planned.

## Capture

Web/desktop/mobile must request microphone permission before recording. No background recording without visible state.

## Transcription

Endpoint exists:

```text
POST /api/voice/transcribe
```

It returns `501` until real STT provider is configured.

## TTS

Endpoint:

```text
POST /api/voice/speak
```

Frontend calls Worker. Worker calls provider. API keys never reach frontend.

## Voice Selection

Endpoints:

```text
GET /api/voice/voices
GET /api/voice/settings?user_id=<id>
PUT /api/voice/settings
```

Settings are stored per user.

## Playback

- Web: browser audio element or Web Audio.
- Desktop: Tauri audio/plugin layer.
- Mobile: Expo AV or native module.

Desktop/mobile playback are pending.

## Disable Voice

Set `ttsEnabled=false` or `autoPlayResponses=false`.

## Privacy Mode

Privacy mode means no auto playback, no wake word, no audio persistence, and text-only responses.
