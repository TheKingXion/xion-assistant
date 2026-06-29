# Cloudflare Stack desde Dashboard

Guia directa para montar Xion Assistant usando `dash.cloudflare.com`.

- Web publica, panel privado y panel admin: Cloudflare Pages.
- API principal: Cloudflare Worker.
- Base de datos: Cloudflare D1.
- Releases, APKs, instaladores y manifests: Cloudflare R2.
- Dominios oficiales:
  - Web: `assistant.xion.<TU_DOMINIO>`
  - API: `api.asst.xion.<TU_DOMINIO>`

No usar `admin.<TU_DOMINIO>`, `api.<TU_DOMINIO>` ni `app.<TU_DOMINIO>`, para evitar choque con otros proyectos.

## 1. Subir repo

El repo debe estar en GitHub antes de conectar Pages o Worker.

```powershell
git add .
git commit -m "docs: add cloudflare dashboard setup"
git push
```

## 2. Crear D1

En `dash.cloudflare.com`:

1. Ir a `Workers & Pages`.
2. Abrir `D1 SQL Database`.
3. Click `Create database`.
4. Nombre:

```text
xion-assistant
```

5. Click `Create`.
6. Copiar `database_id`.
7. Pegar ese ID en `workers/api/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "xion-assistant"
database_id = "TU_DATABASE_ID_REAL"
migrations_dir = "migrations"
```

Importante: binding debe llamarse exactamente `DB`, porque Worker lee `env.DB`.

### Crear tablas

Opcion recomendada con Wrangler:

```powershell
pnpm --filter @xion-assistant/api exec wrangler d1 migrations apply xion-assistant --remote
```

Opcion dashboard:

1. Entrar a D1 `xion-assistant`.
2. Abrir tab `Console`.
3. Copiar SQL de cada archivo en orden:

```text
workers/api/migrations/0001_initial.sql
workers/api/migrations/0002_command_registry.sql
```

4. Pegar cada migration completa.
5. Click `Execute`.

## 3. Crear R2 para releases

En dashboard:

1. Abrir `R2 Object Storage`.
2. Si Cloudflare pide activar R2, activar.
3. Click `Create bucket`.
4. Nombre:

```text
xion-assistant-releases
```

5. Location: `Automatic` o default.
6. Click `Create bucket`.
7. No activar acceso publico.

El bucket queda privado. Descargas deben pasar por Worker o por URLs firmadas cuando se implemente release real.

Rutas previstas:

```text
desktop/windows/xion-assistant-setup-0.10.1.exe
mobile/android/xion-assistant-0.10.1.apk
latest/windows.json
latest/android.json
checksums/
changelogs/
```

## 4. Crear Worker API

En dashboard:

1. Ir a `Workers & Pages`.
2. Click `Create`.
3. Elegir `Worker`.
4. Nombre:

```text
xion-assistant-api
```

5. Deploy inicial.

## 5. Conectar Worker a Git

Dentro del Worker `xion-assistant-api`:

1. Ir a `Settings`.
2. Abrir `Builds`.
3. Click `Connect Git`.
4. Seleccionar repo `xion-assistant`.
5. Configurar:

```text
Root directory: workers/api
Build command: corepack enable && corepack pnpm install --frozen-lockfile
Deploy command: corepack pnpm run deploy
```

Si pide output directory, dejar vacio.

## 6. Bindings del Worker

Dentro del Worker `xion-assistant-api`:

1. Ir a `Settings`.
2. Abrir `Bindings`.
3. Add binding D1:

```text
Type: D1 database
Variable name: DB
Database: xion-assistant
```

4. Add binding R2:

```text
Type: R2 bucket
Variable name: RELEASES
Bucket: xion-assistant-releases
```

Importante:

- `DB` debe llamarse exactamente `DB`.
- `RELEASES` debe llamarse exactamente `RELEASES`.
- `database_id` real debe estar en `workers/api/wrangler.toml`.

## 7. Variables y secrets del Worker

Ruta:

```text
Workers & Pages > xion-assistant-api > Settings > Variables and Secrets
```

Agregar como variables:

```env
PUBLIC_WEB_URL=https://assistant.xion.<TU_DOMINIO>
PUBLIC_API_URL=https://api.asst.xion.<TU_DOMINIO>
AI_PROVIDER=mock
AI_MODEL=mock-assistant
AI_TTS_PROVIDER=mock
AI_TTS_DEFAULT_VOICE=xion_voice_1
AI_TTS_DEFAULT_LANGUAGE=es-CL
AI_TTS_DEFAULT_SPEED=1
```

Agregar como secrets:

```env
JWT_SECRET=secret_largo_random
TOKEN_ENCRYPTION_KEY=secret_largo_random_distinto
AI_API_KEY=solo_si_usas_proveedor_real
GOOGLE_CLIENT_ID=cuando_actives_google
GOOGLE_CLIENT_SECRET=cuando_actives_google
SPOTIFY_CLIENT_ID=cuando_actives_spotify
SPOTIFY_CLIENT_SECRET=cuando_actives_spotify
```

Generar secretos seguros en PowerShell:

```powershell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

Despues de cambiar variables/secrets:

1. Guardar.
2. Ir a `Deployments`.
3. Click `Retry deployment` o hacer nuevo push.
4. Probar health.

```powershell
curl https://api.asst.xion.<TU_DOMINIO>/api/health
```

## 8. Dominio del Worker

Dentro de `xion-assistant-api`:

1. Ir a `Settings`.
2. Abrir `Domains & Routes`.
3. Click `Add custom domain`.
4. Usar:

```text
api.asst.xion.<TU_DOMINIO>
```

5. Confirmar DNS.

Alternativa por route en `workers/api/wrangler.toml`:

```toml
[[routes]]
pattern = "api.asst.xion.<TU_DOMINIO>/*"
zone_name = "<TU_DOMINIO>"
```

## 9. Crear Pages Web

En dashboard:

1. Ir a `Workers & Pages`.
2. Click `Create`.
3. Elegir `Pages`.
4. Click `Connect to Git`.
5. Seleccionar repo `xion-assistant`.
6. Project name:

```text
xion-assistant
```

7. Build settings:

```text
Framework preset: Vite
Root directory: /
Build command: corepack enable && corepack pnpm install --frozen-lockfile && corepack pnpm --filter @xion-assistant/web build
Build output directory: apps/web/dist
```

8. Deploy.

## 10. Variables de Pages

Dentro de Pages `xion-assistant`:

1. Ir a `Settings`.
2. Abrir `Environment variables`.
3. En `Production`, agregar:

```env
VITE_PUBLIC_API_URL=https://api.asst.xion.<TU_DOMINIO>
```

4. Si usas preview deployments, repetir en `Preview`.
5. Guardar.
6. Hacer `Retry deployment`.

Las variables `VITE_*` se leen durante build. Si cambias `VITE_PUBLIC_API_URL` y no redeployas Pages, web puede seguir usando URL antigua.

## 11. Dominio de Pages

Dentro de Pages `xion-assistant`:

1. Ir a `Custom domains`.
2. Click `Set up a custom domain`.
3. Usar:

```text
assistant.xion.<TU_DOMINIO>
```

4. Confirmar DNS.
5. Esperar SSL activo.

## 12. GitHub Secrets

En GitHub:

1. Entrar al repo `xion-assistant`.
2. Ir a `Settings`.
3. Abrir `Secrets and variables`.
4. Abrir `Actions`.
5. Crear secrets:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_D1_DATABASE_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
JWT_SECRET
TOKEN_ENCRYPTION_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
SPOTIFY_CLIENT_ID
SPOTIFY_CLIENT_SECRET
AI_PROVIDER
AI_API_KEY
AI_MODEL
AI_SMALL_MODEL
AI_STT_MODEL
AI_TTS_MODEL
AI_TTS_PROVIDER
AI_TTS_DEFAULT_VOICE
AI_TTS_DEFAULT_LANGUAGE
AI_TTS_DEFAULT_SPEED
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
TAURI_PRIVATE_KEY
TAURI_KEY_PASSWORD
PUBLIC_WEB_URL
PUBLIC_API_URL
```

Valores:

```env
R2_BUCKET_NAME=xion-assistant-releases
PUBLIC_WEB_URL=https://assistant.xion.<TU_DOMINIO>
PUBLIC_API_URL=https://api.asst.xion.<TU_DOMINIO>
```

Token Cloudflare minimo recomendado:

```text
Account - Cloudflare Workers Scripts - Edit
Account - Workers R2 Storage - Edit
Account - D1 - Edit
Account - Pages - Edit
Account - Account Settings - Read
Zone - DNS - Edit
```

## 13. Deploy manual por comandos

Usar si prefieres Wrangler local:

```powershell
pnpm exec wrangler login
pnpm --filter @xion-assistant/api exec wrangler d1 create xion-assistant
pnpm exec wrangler r2 bucket create xion-assistant-releases
pnpm --filter @xion-assistant/api exec wrangler d1 migrations apply xion-assistant --remote
pnpm --filter @xion-assistant/api deploy
pnpm --filter @xion-assistant/web build
pnpm exec wrangler pages project create xion-assistant
pnpm exec wrangler pages deploy apps/web/dist --project-name xion-assistant
```

Secrets por comando:

```powershell
pnpm --filter @xion-assistant/api exec wrangler secret put JWT_SECRET
pnpm --filter @xion-assistant/api exec wrangler secret put TOKEN_ENCRYPTION_KEY
pnpm --filter @xion-assistant/api exec wrangler secret put AI_API_KEY
```

## 14. Probar API

Abrir:

```text
https://api.asst.xion.<TU_DOMINIO>/api/health
```

Debe responder:

```json
{"ok":true,"service":"xion-assistant-api"}
```

Si respuesta exacta cambia, basta con que `ok` sea `true`.

## 15. Probar Web

Abrir:

```text
https://assistant.xion.<TU_DOMINIO>
```

Debe mostrar login/registro y panel de asistente.

## 16. Probar registro y login

Desde web:

1. Crear usuario.
2. Iniciar sesion.
3. Enviar mensaje:

```text
Pon una alarma a las 6:45
```

Debe responder sin usar IA si Command Registry detecta comando.

Por curl:

```powershell
curl -X POST https://api.asst.xion.<TU_DOMINIO>/api/auth/register `
  -H "content-type: application/json" `
  -d "{\"email\":\"luis@example.com\",\"password\":\"change-me-1234\",\"displayName\":\"Luis\"}"
```

Luego usar token devuelto como Bearer en rutas privadas.

## 17. Probar R2 releases

No publicar releases sin checksum real.

Generar checksums:

```powershell
pnpm release:checksums dist/releases dist/releases/checksums.json
```

Verificar manifest:

```powershell
pnpm release:verify dist/releases/latest.json
```

Cuando exista artefacto real, subir manual:

```powershell
$env:CLOUDFLARE_API_TOKEN="TU_TOKEN"
pnpm exec wrangler r2 object put xion-assistant-releases/latest/android.json --file dist/releases/latest.json --content-type "application/json; charset=utf-8"
```

## 18. Cada actualizacion

Flujo esperado:

1. Subir version en `package.json` y packages tocados.
2. Build artefactos.
3. Generar sha256.
4. Generar `latest/windows.json` o `latest/android.json`.
5. Verificar manifest.
6. Subir instalador/APK a R2.
7. Subir checksum y changelog.
8. Hacer commit, tag y push.

Regla:

```text
version nueva > version instalada = app muestra update
checksum coincide = descarga valida
checksum falla = update bloqueado
```

## 19. Diagnostico rapido

API:

```powershell
curl https://api.asst.xion.<TU_DOMINIO>/api/health
```

Pages:

```powershell
curl https://assistant.xion.<TU_DOMINIO>
```

Logs Worker:

```powershell
pnpm --filter @xion-assistant/api exec wrangler tail
```

Migrations remotas:

```powershell
pnpm --filter @xion-assistant/api exec wrangler d1 migrations list xion-assistant --remote
```

## Checklist final

- D1 `xion-assistant` creado.
- `database_id` real puesto en `workers/api/wrangler.toml`.
- Migraciones `0001_initial.sql` y `0002_command_registry.sql` aplicadas.
- R2 `xion-assistant-releases` creado.
- Worker `xion-assistant-api` creado.
- Worker conectado a repo.
- Binding `DB` conectado a D1.
- Binding `RELEASES` conectado a R2.
- Worker variables `PUBLIC_WEB_URL`, `PUBLIC_API_URL`, `AI_PROVIDER`, `AI_MODEL` configuradas.
- Worker secrets `JWT_SECRET` y `TOKEN_ENCRYPTION_KEY` configurados.
- Worker domain `api.asst.xion.<TU_DOMINIO>` activo.
- Pages `xion-assistant` creado.
- Pages conectado a repo.
- Pages variable `VITE_PUBLIC_API_URL` apunta a API real.
- Pages domain `assistant.xion.<TU_DOMINIO>` activo.
- GitHub secrets creados.
- `https://api.asst.xion.<TU_DOMINIO>/api/health` responde OK.
- `https://assistant.xion.<TU_DOMINIO>` abre web.
- Registro/login funcionan.
- Command Registry responde comandos basicos.
- R2 queda privado.
- Releases futuras pasan por checksum antes de publicarse.
