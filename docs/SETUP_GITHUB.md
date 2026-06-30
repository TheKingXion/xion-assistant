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

Required later for real Android APK build/signing:

```text
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
```

Required later for real desktop/Tauri signing/updater:

```text
TAURI_PRIVATE_KEY
TAURI_KEY_PASSWORD
```

Required later when workflows upload releases to R2 through S3 credentials:

```text
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
```

Worker runtime secrets like `AI_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` should live in Cloudflare Worker secrets. Add them to GitHub only if a workflow needs to deploy or seed them.

`deploy-api.yml` and `deploy-web.yml` are manual-only because Cloudflare Dashboard Git integration deploys API and Pages on push. This avoids duplicate failing checks when Cloudflare already deployed successfully.

Do not publish release artifacts without checksum.
