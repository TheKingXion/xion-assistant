# Mobile App

Project:

```text
apps/mobile
```

Stack:

- Expo SDK 52.
- React Native 0.76.
- Email login/register through Worker API.
- Chat through `/api/assistant/message`.
- TTS through `/api/voice/speak`.
- Microphone recording through Expo AV.
- STT through `/api/voice/transcribe`.
- Android APK built by GitHub Actions and uploaded to R2.

## Public download

Web button:

```text
https://assistant.xion.exiliadosrpv2.uk
```

Button calls:

```text
GET /api/updates/latest?platform=android&channel=stable
```

Then downloads:

```text
/releases/mobile/android/xion-assistant-0.12.0.apk
```

## Configure API URL

GitHub variable:

```text
PUBLIC_API_URL=https://api.asst.xion.exiliadosrpv2.uk
```

The workflow exposes it as:

```text
EXPO_PUBLIC_API_URL
```

`apps/mobile/app.config.cjs` injects it into Expo config.
