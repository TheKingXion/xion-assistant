# Environment Variables

| Name | Required | Where | Safe Example | Description |
|---|---:|---|---|---|
| `PUBLIC_WEB_URL` | Yes | Worker, GitHub | `https://assistant.xion.<TU_DOMINIO>` | Public web URL. |
| `PUBLIC_API_URL` | Yes | Worker, GitHub | `https://api.asst.xion.<TU_DOMINIO>` | API URL. |
| `VITE_PUBLIC_API_URL` | Yes web | Pages, local | `http://localhost:8787` | Browser API target. |
| `JWT_SECRET` | Yes | Worker secret | `change-me-32-plus-chars` | Session signing secret. |
| `TOKEN_ENCRYPTION_KEY` | Yes | Worker secret | `change-me-32-plus-chars` | OAuth token encryption key. |
| `AI_PROVIDER` | Yes | Worker | `google` | AI provider name. Use `mock` for tests. |
| `AI_API_KEY` | Yes for google | Worker secret | hidden | Provider API key, never frontend. |
| `AI_MODEL` | Yes | Worker | `gemini-2.5-flash` | Main model. |
| `AI_SMALL_MODEL` | Optional | Worker | `gemini-2.5-flash` | Classifier/planning model. |
| `AI_VISION_MODEL` | Optional | Worker | `mock-vision` | Future vision model. |
| `AI_STT_MODEL` | Optional | Worker | `gemini-2.5-flash` | STT model. STT endpoint still pending real implementation. |
| `AI_TTS_MODEL` | Optional | Worker | `gemini-2.5-flash-preview-tts` | TTS model. |
| `AI_TTS_PROVIDER` | Yes | Worker | `google` | TTS provider. Use `mock` for tests. |
| `AI_TTS_DEFAULT_VOICE` | Yes | Worker | `Kore` | Default voice id. |
| `AI_TTS_DEFAULT_LANGUAGE` | Yes | Worker | `es-CL` | Default language. |
| `AI_TTS_DEFAULT_SPEED` | Yes | Worker | `1` | Default speed. |
| `CLOUDFLARE_API_TOKEN` | Deploy | GitHub secret | hidden | Deploy token. |
| `CLOUDFLARE_ACCOUNT_ID` | Deploy | GitHub secret | hidden | Account id. |
| `CLOUDFLARE_D1_DATABASE_ID` | Deploy | GitHub secret | hidden | D1 database id. |
| `R2_ACCESS_KEY_ID` | Release | GitHub secret | hidden | R2 S3 access id. |
| `R2_SECRET_ACCESS_KEY` | Release | GitHub secret | hidden | R2 S3 secret. |
| `R2_BUCKET_NAME` | Release | GitHub secret | `xion-assistant-releases` | Release bucket. |
| `GOOGLE_CLIENT_ID` | Yes for Google login | Worker secret, GitHub if Actions deploy Worker | hidden | Google OAuth client id for login/register and Google connectors. |
| `GOOGLE_CLIENT_SECRET` | Yes for Google login | Worker secret, GitHub if Actions deploy Worker | hidden | Google OAuth client secret for login/register and Google connectors. |
| `SPOTIFY_CLIENT_ID` | Later | GitHub/Worker | hidden | Spotify OAuth id. |
| `SPOTIFY_CLIENT_SECRET` | Later | GitHub/Worker secret | hidden | Spotify OAuth secret. |
| `ANDROID_KEYSTORE_BASE64` | Later | GitHub secret | hidden | Android signing. |
| `ANDROID_KEYSTORE_PASSWORD` | Later | GitHub secret | hidden | Android signing. |
| `ANDROID_KEY_ALIAS` | Later | GitHub secret | hidden | Android signing. |
| `TAURI_PRIVATE_KEY` | Later | GitHub secret | hidden | Tauri updater signing. |
| `TAURI_KEY_PASSWORD` | Later | GitHub secret | hidden | Tauri key password. |
