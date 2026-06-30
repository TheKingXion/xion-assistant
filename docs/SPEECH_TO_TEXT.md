# Speech To Text

`v0.12.0` supports mobile STT through Worker API.

## Capture

Clients record only after explicit microphone permission. UI must show recording indicator and cancel option.

## Send Audio

Clients send a short audio blob to:

```text
POST /api/voice/transcribe
```

Payload:

```json
{
  "audio_base64": "<audio>",
  "mime_type": "audio/mp4",
  "language": "es-CL"
}
```

The endpoint requires bearer auth.

## Errors

Response:

```json
{"ok":true,"text":"transcribed text"}
```

With `AI_PROVIDER=google`, Worker sends audio to Gemini using `AI_STT_MODEL`.

## Privacy

No 24/7 audio to backend. No permanent audio storage by default.
