# Setup GitHub

Workflows:

- `test.yml`
- `deploy-api.yml`
- `deploy-web.yml`
- `build-desktop.yml`
- `build-android.yml`
- `publish-release.yml`

## Repository Variables

Use `Settings > Secrets and variables > Actions > Variables`.

Correct current variables:

```text
PUBLIC_API_URL=https://api.asst.xion.exiliadosrpv2.uk
PUBLIC_WEB_URL=https://assistant.xion.exiliadosrpv2.uk
R2_BUCKET_NAME=xion-assistant-releases
```

These are not secrets. Workflows read them with `vars.PUBLIC_API_URL`, `vars.PUBLIC_WEB_URL` and `vars.R2_BUCKET_NAME`.

## Repository Secrets

Use `Settings > Secrets and variables > Actions > Secrets`.

Required now:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_D1_DATABASE_ID
JWT_SECRET
TOKEN_ENCRYPTION_KEY
```

Your screenshot has these correctly as secrets.

Required now for Android APK build/signing:

```text
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
```

Create them with [ANDROID_SIGNING.md](./ANDROID_SIGNING.md). Do not put these values in repository variables.

Required later for real desktop/Tauri signing/updater:

```text
TAURI_PRIVATE_KEY
TAURI_KEY_PASSWORD
```

Worker runtime secrets like `AI_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` should live in Cloudflare Worker secrets. Add them to GitHub only if a workflow needs to deploy or seed them.

`deploy-api.yml` and `deploy-web.yml` are manual-only because Cloudflare Dashboard Git integration deploys API and Pages on push. This avoids duplicate failing checks when Cloudflare already deployed successfully.

Do not publish release artifacts without checksum.

## Android auto build and R2 upload

`build-android.yml` runs on:

- Manual `Actions > Build Android > Run workflow`.
- Any pushed tag like `v0.12.0`.

Flow:

1. GitHub installs dependencies.
2. Runs all tests.
3. Runs Expo prebuild for `apps/mobile`.
4. Decodes `ANDROID_KEYSTORE_BASE64`.
5. Signs release APK with `ANDROID_KEYSTORE_PASSWORD` and `ANDROID_KEY_ALIAS`.
6. Creates `dist/releases/mobile/android/xion-assistant-<version>.apk`.
7. Creates checksum and `latest.json`.
8. Uploads to R2 bucket from `R2_BUCKET_NAME` using Wrangler and `CLOUDFLARE_API_TOKEN`.

Expected R2 keys:

```text
mobile/android/xion-assistant-0.12.0.apk
mobile/android/latest.json
checksums.json
```

The public download URL comes from Worker API:

```text
https://api.asst.xion.exiliadosrpv2.uk/releases/mobile/android/xion-assistant-0.12.0.apk
```
