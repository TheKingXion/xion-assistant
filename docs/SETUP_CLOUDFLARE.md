# Cloudflare Stack desde GitHub y Dashboard

Guia directa para desplegar Xion Assistant usando solo:

- GitHub.
- `dash.cloudflare.com`.

No usar comandos locales en esta guia. No usar Wrangler manual. No usar variables locales para produccion.

## 0. Mapa oficial

Dominios:

```text
Web / panel / admin: assistant.xion.<TU_DOMINIO>
API: api.asst.xion.<TU_DOMINIO>
```

Recursos Cloudflare:

```text
Worker API: xion-assistant-api
Pages Web/Admin: xion-assistant
D1: xion-assistant
R2: xion-assistant-releases
```

Reglas:

- No usar `admin.<TU_DOMINIO>`.
- No usar `api.<TU_DOMINIO>`.
- No usar `app.<TU_DOMINIO>`.
- Secrets nunca van a Pages.
- Pages solo recibe variables publicas `VITE_*`.
- D1/R2 se conectan como bindings, no como variables de texto.
- El mismo repo GitHub alimenta Worker API y Pages.
- Cada proyecto Cloudflare tiene su propio root, variables, bindings y dominio.

## 1. Confirmar repo en GitHub

En GitHub:

1. Abrir repo `xion-assistant`.
2. Confirmar que rama principal es `main`.
3. Confirmar que existe:

```text
workers/api/wrangler.toml
workers/api/migrations/0001_initial.sql
workers/api/migrations/0002_command_registry.sql
apps/web
```

4. Confirmar que `workers/api/wrangler.toml` contiene:

```toml
keep_vars = true
```

Esto evita que deploys del Worker borren variables normales creadas en Cloudflare Dashboard.

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
7. En GitHub, editar `workers/api/wrangler.toml`.
8. Poner ese UUID real en:

```toml
[[d1_databases]]
binding = "DB"
database_name = "xion-assistant"
database_id = "UUID_REAL_DE_D1"
migrations_dir = "migrations"
```

9. Guardar el cambio en GitHub con commit en `main`.

Importante:

- Binding debe llamarse exactamente `DB`.
- No dejar `< >` alrededor del UUID.
- No poner datos privados en `wrangler.toml`.

## 3. Crear tablas D1 desde Dashboard

En `dash.cloudflare.com`:

1. Ir a `Workers & Pages`.
2. Abrir `D1 SQL Database`.
3. Abrir `xion-assistant`.
4. Abrir tab `Console`.
5. En GitHub, abrir `workers/api/migrations/0001_initial.sql`.
6. Copiar contenido completo.
7. Pegarlo en consola D1.
8. Click `Execute`.
9. En GitHub, abrir `workers/api/migrations/0002_command_registry.sql`.
10. Copiar contenido completo.
11. Pegarlo en consola D1.
12. Click `Execute`.

Si Cloudflare muestra error de tabla ya existente, revisar si migration ya fue aplicada antes. No repetir migrations sin leer el error.

## 4. Crear R2

En `dash.cloudflare.com`:

1. Ir a `R2 Object Storage`.
2. Activar R2 si Cloudflare lo pide.
3. Click `Create bucket`.
4. Nombre:

```text
xion-assistant-releases
```

5. Location: `Automatic` o default.
6. Click `Create bucket`.
7. Mantener bucket privado.

Rutas previstas dentro del bucket:

```text
desktop/windows/
mobile/android/
latest/windows.json
latest/android.json
checksums/
changelogs/
```

No publicar instaladores/APKs reales sin checksum.

## 5. Crear Worker API

En `dash.cloudflare.com`:

1. Ir a `Workers & Pages`.
2. Click `Create`.
3. Elegir `Worker`.
4. Nombre:

```text
xion-assistant-api
```

5. Crear Worker.

## 6. Conectar Worker API a GitHub

Dentro de `xion-assistant-api`:

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

6. Guardar.
7. Ejecutar deployment desde Cloudflare.

Si Cloudflare pide output directory para Worker, dejar vacio.

## 7. Conectar bindings del Worker

Dentro de `xion-assistant-api`:

1. Ir a `Settings`.
2. Abrir `Bindings`.
3. Agregar D1 binding:

```text
Type: D1 database
Variable name: DB
Database: xion-assistant
```

4. Agregar R2 binding:

```text
Type: R2 bucket
Variable name: RELEASES
Bucket: xion-assistant-releases
```

5. Guardar.
6. Ir a `Deployments`.
7. Click `Retry deployment`.

## 8. Variables y secrets del Worker API

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
JWT_SECRET=valor_largo_random
TOKEN_ENCRYPTION_KEY=valor_largo_random_distinto
```

Secrets futuros, solo cuando actives proveedor real:

```env
AI_API_KEY=solo_si_usas_proveedor_real
GOOGLE_CLIENT_ID=cuando_actives_google
GOOGLE_CLIENT_SECRET=cuando_actives_google
SPOTIFY_CLIENT_ID=cuando_actives_spotify
SPOTIFY_CLIENT_SECRET=cuando_actives_spotify
```

Regla:

- `JWT_SECRET` y `TOKEN_ENCRYPTION_KEY` deben ser largos y distintos.
- No poner secrets en Pages.
- No poner secrets en GitHub como texto visible.
- Despues de guardar variables/secrets, ir a `Deployments` y hacer `Retry deployment`.

## 9. Si variables desaparecen despues de build

Sintoma:

```text
Variables and Secrets solo muestra:
JWT_SECRET
TOKEN_ENCRYPTION_KEY
```

Fix:

1. En GitHub, abrir `workers/api/wrangler.toml`.
2. Confirmar:

```toml
keep_vars = true
```

3. Confirmar que ese cambio existe en `main`.
4. Esperar nuevo deployment del Worker.
5. Volver a agregar variables normales una sola vez:

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

6. Guardar.
7. Retry deployment.

Siguientes builds no deben borrar variables.

## 10. Dominio del Worker API

Dentro de `xion-assistant-api`:

1. Ir a `Settings`.
2. Abrir `Domains & Routes`.
3. Click `Add custom domain`.
4. Usar:

```text
api.asst.xion.<TU_DOMINIO>
```

5. Confirmar.
6. Esperar DNS/SSL activo.

Para dominio real actual:

```text
api.asst.xion.exiliadosrpv2.uk
```

Validacion desde navegador:

```text
https://api.asst.xion.<TU_DOMINIO>/api/health
```

Debe responder JSON con `ok: true`.

## 11. Crear Pages Web/Admin

Crear solo si aun no existe `xion-assistant`.

En `dash.cloudflare.com`:

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

## 12. Variables de Pages

Dentro de Pages `xion-assistant`:

1. Ir a `Settings`.
2. Abrir `Environment variables`.
3. En `Production`, agregar:

```env
VITE_PUBLIC_API_URL=https://api.asst.xion.<TU_DOMINIO>
```

4. En `Preview`, agregar lo mismo solo si usas preview deployments.
5. Guardar.
6. Ir a `Deployments`.
7. Click `Retry deployment`.

No poner en Pages:

```text
JWT_SECRET
TOKEN_ENCRYPTION_KEY
AI_API_KEY
GOOGLE_CLIENT_SECRET
SPOTIFY_CLIENT_SECRET
```

## 13. Dominio de Pages

Dentro de Pages `xion-assistant`:

1. Ir a `Custom domains`.
2. Click `Set up a custom domain`.
3. Usar:

```text
assistant.xion.<TU_DOMINIO>
```

4. Confirmar.
5. Esperar DNS/SSL activo.

Para dominio real actual:

```text
assistant.xion.exiliadosrpv2.uk
```

Validacion desde navegador:

```text
https://assistant.xion.<TU_DOMINIO>
```

Debe abrir web/login/panel.

## 14. GitHub Actions secrets

En GitHub:

1. Abrir repo `xion-assistant`.
2. Ir a `Settings`.
3. Abrir `Secrets and variables`.
4. Abrir `Actions`.
5. Crear secrets necesarios ahora:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_D1_DATABASE_ID
R2_BUCKET_NAME
JWT_SECRET
TOKEN_ENCRYPTION_KEY
PUBLIC_WEB_URL
PUBLIC_API_URL
```

Valores no secretos:

```env
R2_BUCKET_NAME=xion-assistant-releases
PUBLIC_WEB_URL=https://assistant.xion.<TU_DOMINIO>
PUBLIC_API_URL=https://api.asst.xion.<TU_DOMINIO>
```

Pendientes para fases futuras:

```text
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
SPOTIFY_CLIENT_ID
SPOTIFY_CLIENT_SECRET
AI_API_KEY
AI_SMALL_MODEL
AI_STT_MODEL
AI_TTS_MODEL
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
TAURI_PRIVATE_KEY
TAURI_KEY_PASSWORD
```

Permisos recomendados para token Cloudflare:

```text
Account - Cloudflare Workers Scripts - Edit
Account - Workers R2 Storage - Edit
Account - D1 - Edit
Account - Pages - Edit
Account - Account Settings - Read
Zone - DNS - Edit
```

## 15. Google OAuth desde Dashboard

Usar guia completa:

```text
docs/GOOGLE_OAUTH_DASHBOARD.md
```

Valores principales:

```text
Authorized JavaScript origin:
https://assistant.xion.exiliadosrpv2.uk

Authorized redirect URI:
https://api.asst.xion.exiliadosrpv2.uk/api/oauth/google/callback
```

Despues de crear OAuth Client:

1. Copiar `GOOGLE_CLIENT_ID`.
2. Copiar `GOOGLE_CLIENT_SECRET`.
3. Ir a Cloudflare Worker `xion-assistant-api`.
4. Abrir `Settings > Variables and Secrets`.
5. Agregar ambos como secrets.
6. Retry deployment.

## 16. Validacion final desde navegador

API:

```text
https://api.asst.xion.<TU_DOMINIO>/api/health
```

Web:

```text
https://assistant.xion.<TU_DOMINIO>
```

OAuth start:

```text
https://api.asst.xion.<TU_DOMINIO>/api/oauth/google/start?user_id=test-user
```

Si API no abre, revisar:

- Worker deployment activo.
- Custom domain activo.
- DNS/SSL listo.
- `PUBLIC_API_URL` correcto.
- Binding `DB` conectado.
- Binding `RELEASES` conectado.

Si web abre pero no conecta a API, revisar:

- Pages variable `VITE_PUBLIC_API_URL`.
- Pages redeploy despues de cambiar variable.
- API custom domain activo.

## Checklist final

- Repo `xion-assistant` existe en GitHub.
- Rama `main` tiene `workers/api/wrangler.toml`.
- `keep_vars = true` existe en `wrangler.toml`.
- D1 `xion-assistant` creado.
- `database_id` real puesto en GitHub.
- Migrations `0001_initial.sql` y `0002_command_registry.sql` aplicadas desde D1 Console.
- R2 `xion-assistant-releases` creado y privado.
- Worker `xion-assistant-api` creado.
- Worker conectado a GitHub con root `workers/api`.
- Binding `DB` conectado a D1.
- Binding `RELEASES` conectado a R2.
- Worker variables normales configuradas.
- Worker secrets `JWT_SECRET` y `TOKEN_ENCRYPTION_KEY` configurados.
- Worker custom domain `api.asst.xion.<TU_DOMINIO>` activo.
- Pages `xion-assistant` creado.
- Pages conectado a GitHub.
- Pages variable `VITE_PUBLIC_API_URL` configurada.
- Pages custom domain `assistant.xion.<TU_DOMINIO>` activo.
- GitHub Actions secrets creados.
- API health responde `ok: true`.
- Web abre correctamente.
- Secrets no existen en frontend.
- Workers extra de Voice/Releases no creados todavia.
