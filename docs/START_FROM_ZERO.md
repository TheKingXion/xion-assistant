# START FROM ZERO

Estado: `v0.10.6` foundation. Incluye Command Registry autenticado, shortcuts privados, metricas, UI, migracion `0002`, guia Cloudflare cloud-first solo con GitHub/Dashboard, pasos Google OAuth para dominio real y proteccion `keep_vars = true` para que deploys Worker no borren variables del dashboard. Deploy real requiere recursos y secrets Cloudflare.

## Cloudflare: Worker, Pages, D1 y R2

Guia completa estilo Xion-TV: `docs/SETUP_CLOUDFLARE.md`.

Regla produccion:

- Todo corre en Cloudflare: Pages, Workers, D1, R2 y variables.
- Un solo repo GitHub puede alimentar todo: Pages, Worker API y futuros Workers.
- En Cloudflare conectas el mismo repo varias veces; cambias root/build/domain/bindings por proyecto.
- `.env` local es solo desarrollo.
- Secrets productivos se guardan en `Workers & Pages > <proyecto> > Settings > Variables and Secrets`.
- Variables publicas web se guardan en Pages como `VITE_*`.
- Ahora solo existe y se configura `xion-assistant-api`; Workers extra quedan pendientes.
- Bindings `DB` y `RELEASES` se configuran como bindings Cloudflare, no como texto en frontend.
- No dejar `[[routes]]` con `<TU_DOMINIO>` en `wrangler.toml`; eso rompe `wrangler deploy`.
- Mantener `keep_vars = true` en `workers/api/wrangler.toml`; sin eso, `wrangler deploy` puede borrar variables dashboard del Worker.
- Primero despliega `xion-assistant-api`; despues crea Pages `xion-assistant` si aun no existe.

Orden desde dashboard:

1. Crear D1 `xion-assistant`.
2. Aplicar migraciones `workers/api/migrations/0001_initial.sql` y `0002_command_registry.sql`.
3. Crear R2 `xion-assistant-releases`.
4. Crear Worker `xion-assistant-api`.
5. Conectar Worker al mismo repo GitHub con root `workers/api`.
6. Crear bindings `DB` y `RELEASES`.
7. Configurar variables/secrets del Worker API en Cloudflare.
8. Asignar dominio Worker `api.asst.xion.<TU_DOMINIO>`.
9. Crear Pages `xion-assistant`.
10. Conectar Pages al mismo repo GitHub con output `apps/web/dist`.
11. Configurar `VITE_PUBLIC_API_URL`.
12. Asignar dominio Pages `assistant.xion.<TU_DOMINIO>`.
13. Configurar GitHub Secrets.
14. Probar health, web, login, Command Registry y R2.

Comandos equivalentes:

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

Copiar ID D1 a `workers/api/wrangler.toml` sin `< >`. Configurar bindings `DB` y `RELEASES`, secrets `JWT_SECRET`/`TOKEN_ENCRYPTION_KEY`, variable Pages `VITE_PUBLIC_API_URL`, dominio Pages `assistant.xion.<TU_DOMINIO>` y custom domain Worker `api.asst.xion.<TU_DOMINIO>` desde Cloudflare Dashboard.

## Probar Command Registry

1. Crear usuario A desde web y shortcut `tempranito -> alarm.create {"time":"06:45"}`.
2. Ejecutar `despiertame tempranito`; verificar que respuesta indique `usedAiFallback=false` y suban tokens ahorrados.
3. Crear usuario B y mismo shortcut con `08:00`.
4. Confirmar que cada cuenta obtiene su propia hora.
5. Ejecutar `dile a Pedro que voy tarde`; debe pedir contacto o quedar `pending_confirmation`, nunca enviar directamente.

## 1. Requisitos previos

- Node.js 22.
- pnpm 9.
- Git.
- Cuenta GitHub.
- Cuenta Cloudflare.
- Dominio en Cloudflare.
- Wrangler login local.

## 2. Clonar repo

```bash
git clone <TU_REPO_GITHUB> xion-assistant
cd xion-assistant
```

## 3. Instalar dependencias

```bash
pnpm install
```

## 4. Variables locales

```bash
cp .env.example .env
```

Ejemplo seguro:

```env
PUBLIC_WEB_URL=https://assistant.xion.<TU_DOMINIO>
PUBLIC_API_URL=https://api.asst.xion.<TU_DOMINIO>
VITE_PUBLIC_API_URL=http://localhost:8787
JWT_SECRET=replace-with-32-plus-character-secret
TOKEN_ENCRYPTION_KEY=replace-with-32-plus-character-secret
AI_PROVIDER=mock
AI_API_KEY=
AI_TTS_PROVIDER=mock
AI_TTS_DEFAULT_VOICE=xion_voice_1
```

## 5. Crear proyecto Cloudflare

En Cloudflare, confirma que dominio esta en zona activa. No uses `admin.<TU_DOMINIO>` ni `api.<TU_DOMINIO>`.

## 6. Crear D1

```bash
pnpm --filter @xion-assistant/api exec wrangler d1 create xion-assistant
```

Copia `database_id` en `workers/api/wrangler.toml` y en GitHub secret `CLOUDFLARE_D1_DATABASE_ID`.

## 7. Ejecutar migraciones D1

Local:

```bash
pnpm --filter @xion-assistant/api exec wrangler d1 migrations apply xion-assistant --local
```

Remoto:

```bash
pnpm --filter @xion-assistant/api exec wrangler d1 migrations apply xion-assistant --remote
```

## 8. Crear R2

```bash
pnpm exec wrangler r2 bucket create xion-assistant-releases
```

Rutas previstas:

- `/desktop/windows/xion-assistant-setup-0.0.1.exe`
- `/mobile/android/xion-assistant-0.0.1.apk`
- `/latest/windows.json`
- `/latest/android.json`
- `/checksums/`
- `/changelogs/`

## 9. Crear tokens/API keys Cloudflare

Crea token con permisos:

- Workers Scripts: Edit.
- D1: Edit.
- R2: Edit.
- Pages: Edit.
- Zone DNS: Edit si GitHub gestionara DNS.

## 10. GitHub Secrets

Configura:

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

## 11. Subdominios

Usa:

- `assistant.xion.<TU_DOMINIO>` para web/panel.
- `api.asst.xion.<TU_DOMINIO>` para API.

No uses:

- `admin.<TU_DOMINIO>`
- `api.<TU_DOMINIO>`
- `app.<TU_DOMINIO>`

## 12. Worker routes

No uses placeholder en `workers/api/wrangler.toml`. Configura dominio desde Cloudflare Dashboard:

```text
Workers & Pages > xion-assistant-api > Settings > Domains & Routes > Add custom domain
api.asst.xion.<TU_DOMINIO>
```

## 13. Cloudflare Pages

Build command:

```bash
pnpm --filter @xion-assistant/web build
```

Output:

```text
apps/web/dist
```

Custom domain:

```text
assistant.xion.<TU_DOMINIO>
```

## 14. Google OAuth

Pendiente en `v0.0.1`. Tablas y secrets estan preparados. Redirect previsto:

```text
https://api.asst.xion.<TU_DOMINIO>/api/oauth/google/callback
```

## 15. Spotify OAuth

Pendiente en `v0.0.1`. Redirect previsto:

```text
https://api.asst.xion.<TU_DOMINIO>/api/oauth/spotify/callback
```

## 16. AI_API_KEY

`v0.0.1` usa provider `mock`. Para proveedor real, guardar key solo en Cloudflare secret:

```bash
pnpm --filter @xion-assistant/api exec wrangler secret put AI_API_KEY
```

## 17. Texto a voz

`v0.0.1` usa TTS mock. Endpoint:

```bash
curl -X POST http://localhost:8787/api/voice/speak \
  -H "content-type: application/json" \
  -d "{\"text\":\"Hola Luis\",\"user_id\":\"user-a\",\"voice_id\":\"xion_voice_1\"}"
```

## 18. Voz por defecto

```env
AI_TTS_DEFAULT_VOICE=xion_voice_1
AI_TTS_DEFAULT_LANGUAGE=es-CL
AI_TTS_DEFAULT_SPEED=1
```

## 19. Worker local

```bash
pnpm dev:api
```

Health:

```bash
curl http://localhost:8787/api/health
```

`wrangler.toml` includes `[dev] host = "localhost"` so local dev works. Production custom domain is configured from Cloudflare Dashboard, not with placeholder routes in `wrangler.toml`.

## 20. Web local

```bash
pnpm dev:web
```

Abre `http://localhost:5173`.

## 21. Desktop local

Pendiente. Fase 5: Tauri 2, login, chat, voz, tray, hotkey, updater.

## 22. Mobile local

Pendiente. Fase 5: Expo Android, login, chat, voz, APK updater.

## 23. Deploy API

```bash
pnpm --filter @xion-assistant/api deploy
```

## 24. Deploy web

```bash
pnpm --filter @xion-assistant/web build
pnpm exec wrangler pages deploy apps/web/dist --project-name xion-assistant
```

## 25. Compilar APK

Pendiente hasta app mobile. Workflow `build-android.yml` existe como gate placeholder.

## 26. Compilar desktop

Pendiente hasta app desktop. Workflow `build-desktop.yml` existe como gate placeholder.

## 27. Subir builds a R2

No publicar sin checksum real:

```bash
pnpm release:checksums dist/releases dist/releases/checksums.json
```

## 28. Publicar latest.json

Genera manifest real con sha256 real. Luego:

```bash
pnpm release:verify dist/releases/latest.json
pnpm release:publish-version dist/releases/latest.json
```

## 29. Probar auto-update

```bash
curl "http://localhost:8787/api/updates/latest?platform=android&channel=stable"
curl "http://localhost:8787/api/updates/latest?platform=windows&arch=x64&channel=stable"
```

## 30. Primer usuario

```bash
curl -X POST http://localhost:8787/api/auth/register \
  -H "content-type: application/json" \
  -d "{\"email\":\"luis@example.com\",\"password\":\"change-me-1234\",\"displayName\":\"Luis\"}"
```

## 31. Conectar Google

Pendiente Fase 3.

## 32. Conectar Spotify

Pendiente Fase 3.

## 33. Probar memoria por usuario

```bash
curl -X POST http://localhost:8787/api/memory \
  -H "content-type: application/json" \
  -d "{\"userId\":\"user-a\",\"memoryType\":\"contact_alias\",\"key\":\"mi esposa\",\"value\":\"Camila\",\"confirmed\":true,\"confidence\":1}"

curl "http://localhost:8787/api/memory?user_id=user-a"
curl "http://localhost:8787/api/memory?user_id=user-b"
```

## 34. Aprendizaje por confirmacion

`v0.0.1` guarda alias confirmado via endpoint de memoria. Dialogo multi-turn real queda para Fase 2.

## 35. Seleccion de voz

```bash
curl http://localhost:8787/api/voice/voices
curl -X PUT http://localhost:8787/api/voice/settings \
  -H "content-type: application/json" \
  -d "{\"userId\":\"user-a\",\"ttsEnabled\":true,\"sttEnabled\":true,\"wakeWordEnabled\":false,\"selectedVoiceId\":\"xion_voice_1\",\"language\":\"es-CL\",\"speed\":1,\"pitch\":1,\"volume\":1,\"autoPlayResponses\":true}"
```

## 36. Respuesta hablada

Usa `spokenResponse: true` en `/api/assistant/message`.

## 37. Aislamiento usuario A/B

```bash
pnpm --filter @xion-assistant/api test
```

Tests cubren memoria y voz separadas por `user_id`.

## 38. Logs

Local: terminal de Wrangler. Produccion:

```bash
pnpm --filter @xion-assistant/api exec wrangler tail
```

## 39. Errores comunes

Ver `docs/TROUBLESHOOTING.md`.

## Checklist final v0.0.1

- [x] Monorepo.
- [x] Worker API base.
- [x] D1 migration inicial.
- [x] Web console base.
- [x] Memoria por usuario base.
- [x] Voz/TTS mock por usuario.
- [x] Persistencia D1 para usuarios, memoria y configuracion de voz cuando existe binding `DB`.
- [x] Persistencia D1 para sesiones, acciones, confirmaciones y planes.
- [x] CRUD basico de memoria con proteccion por `user_id`.
- [x] Contactos, alias y canales preferidos con proteccion por `user_id`.
- [x] Communication router inicial para preparar mensajes por canal preferido.
- [x] AI Gateway mock/configurable para classify/plan/text.
- [x] Tool registry con risk level y confirmation metadata.
- [x] OAuth start URLs para Google/Spotify.
- [x] OAuth token storage cifrado y redacted por `user_id`.
- [x] OAuth callback token exchange Google/Spotify con perfil provider id.
- [x] Google Calendar list events y create event con confirmacion.
- [x] Spotify playback read y play/pause con confirmacion.
- [x] YouTube search y subscriptions read con Google OAuth.
- [x] Confirmacion requerida para accion de alto riesgo.
- [x] Endpoint updates.
- [x] Workflows.
- [x] Tests minimos.
- [x] Documentacion inicial.
- [ ] OAuth real.
- [ ] Desktop real.
- [ ] Mobile real.
- [ ] R2 upload real.
- [ ] AI provider real.
