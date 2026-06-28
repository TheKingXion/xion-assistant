# Environment Variables

| Name | Required | Where | Safe Example | Description |
|---|---:|---|---|---|
| `PUBLIC_WEB_URL` | Yes | Worker, GitHub | `https://assistant.xion.<TU_DOMINIO>` | Public web URL. |
| `PUBLIC_API_URL` | Yes | Worker, GitHub | `https://api.asst.xion.<TU_DOMINIO>` | API URL. |
| `VITE_PUBLIC_API_URL` | Yes web | Pages, local | `http://localhost:8787` | Browser API target. |
| `JWT_SECRET` | Yes | Worker secret | `change-me-32-plus-chars` | Session signing secret. |
| `TOKEN_ENCRYPTION_KEY` | Yes | Worker secret | `change-me-32-plus-chars` | OAuth token encryption key. |
| `AI_PROVIDER` | Yes | Worker | `mock` | AI provider name. |
| `AI_API_KEY` | Later | Worker secret | empty in v0.0.1 | Provider API key, never frontend. |
| `AI_MODEL` | Yes | Worker | `mock-assistant` | Main model. |
| `AI_SMALL_MODEL` | Optional | Worker | `mock-small` | Cheap classifier model. |
| `AI_VISION_MODEL` | Optional | Worker | `mock-vision` | Future vision model. |
| `AI_STT_MODEL` | Optional | Worker | `mock-stt` | STT model. |
| `AI_TTS_MODEL` | Optional | Worker | `mock-tts` | TTS model. |
| `AI_TTS_PROVIDER` | Yes | Worker | `mock` | TTS provider. |
| `AI_TTS_DEFAULT_VOICE` | Yes | Worker | `xion_voice_1` | Default voice id. |
| `AI_TTS_DEFAULT_LANGUAGE` | Yes | Worker | `es-CL` | Default language. |
| `AI_TTS_DEFAULT_SPEED` | Yes | Worker | `1` | Default speed. |
| `CLOUDFLARE_API_TOKEN` | Deploy | GitHub secret | hidden | Deploy token. |
| `CLOUDFLARE_ACCOUNT_ID` | Deploy | GitHub secret | hidden | Account id. |
| `CLOUDFLARE_D1_DATABASE_ID` | Deploy | GitHub secret | hidden | D1 database id. |
| `R2_ACCESS_KEY_ID` | Release | GitHub secret | hidden | R2 S3 access id. |
| `R2_SECRET_ACCESS_KEY` | Release | GitHub secret | hidden | R2 S3 secret. |
| `R2_BUCKET_NAME` | Release | GitHub secret | `xion-assistant-releases` | Release bucket. |
| `GOOGLE_CLIENT_ID` | Later | GitHub/Worker | hidden | Google OAuth id. |
| `GOOGLE_CLIENT_SECRET` | Later | GitHub/Worker secret | hidden | Google OAuth secret. |
| `SPOTIFY_CLIENT_ID` | Later | GitHub/Worker | hidden | Spotify OAuth id. |
| `SPOTIFY_CLIENT_SECRET` | Later | GitHub/Worker secret | hidden | Spotify OAuth secret. |
| `ANDROID_KEYSTORE_BASE64` | Later | GitHub secret | hidden | Android signing. |
| `ANDROID_KEYSTORE_PASSWORD` | Later | GitHub secret | hidden | Android signing. |
| `ANDROID_KEY_ALIAS` | Later | GitHub secret | hidden | Android signing. |
| `TAURI_PRIVATE_KEY` | Later | GitHub secret | hidden | Tauri updater signing. |
| `TAURI_KEY_PASSWORD` | Later | GitHub secret | hidden | Tauri key password. |
