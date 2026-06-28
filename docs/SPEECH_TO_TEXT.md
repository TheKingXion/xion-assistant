# Speech To Text

`v0.0.1` has STT endpoint placeholder. Real provider pending.

## Capture

Clients record only after explicit microphone permission. UI must show recording indicator and cancel option.

## Send Audio

Future clients send a short audio blob to:

```text
POST /api/voice/transcribe
```

## Errors

Current response:

```json
{"ok":false,"error":"stt_provider_not_configured_in_v0.0.1"}
```

## Privacy

No 24/7 audio to backend. No permanent audio storage by default.
