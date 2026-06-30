# Troubleshooting

## Wrangler no autentica

Run:

```bash
pnpm exec wrangler login
```

## D1 database no encontrada

Confirm `database_id` in `workers/api/wrangler.toml`.

## R2 no sube archivo

Check bucket name and R2 credentials.

## GitHub Actions falla por secret faltante

Compare secrets with `docs/ENVIRONMENT_VARIABLES.md`.

## CORS bloqueado

Set `PUBLIC_WEB_URL` to web origin.

## OAuth redirect URI incorrecta

Use `https://api.asst.xion.<TU_DOMINIO>/api/oauth/<provider>/callback`.

## Worker route no responde

Use Cloudflare Dashboard custom domain, not a placeholder route in `wrangler.toml`.

If this fails:

```powershell
curl https://api.asst.xion.exiliadosrpv2.uk/api/health
```

with:

```text
curl: (6) Could not resolve host
```

then `api.asst.xion.exiliadosrpv2.uk` does not exist in DNS yet. Fix:

1. Go to `Workers & Pages`.
2. Open `xion-assistant-api`.
3. Open `Settings`.
4. Open `Domains & Routes`.
5. Add custom domain `api.asst.xion.exiliadosrpv2.uk`.
6. Wait for Cloudflare DNS/SSL.
7. Retry health curl.

## Pages no apunta al dominio correcto

Check custom domain `assistant.xion.<TU_DOMINIO>`.

## APK no se firma

Android app is pending. Configure keystore secrets before real build.

## Update no aparece

Check `/api/updates/latest` and R2 latest manifest.

## Checksum no coincide

Regenerate checksum and do not publish until `verify-release` passes.

## Microfono no pide permiso

Client app must request microphone permission before recording.

## TTS no genera audio

`v0.0.1` returns mock base64. Real provider pending.

## Voz seleccionada no existe

Call `/api/voice/voices` and use active voice id.

## Audio no reproduce Android/Desktop

Apps are pending. Playback integration belongs to Fase 5.
