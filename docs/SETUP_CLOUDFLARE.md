# Setup Cloudflare

Create D1, R2, Worker route and Pages project for Xion Assistant. Use only:

- `assistant.xion.<TU_DOMINIO>`
- `api.asst.xion.<TU_DOMINIO>`

Commands:

```bash
pnpm exec wrangler login
pnpm --filter @xion-assistant/api exec wrangler d1 create xion-assistant
pnpm exec wrangler r2 bucket create xion-assistant-releases
pnpm --filter @xion-assistant/api exec wrangler d1 migrations apply xion-assistant --remote
pnpm --filter @xion-assistant/api deploy
pnpm --filter @xion-assistant/web build
pnpm exec wrangler pages project create xion-assistant
pnpm exec wrangler pages deploy apps/web/dist --project-name xion-assistant
```

Replace `CLOUDFLARE_D1_DATABASE_ID` in `workers/api/wrangler.toml`. Keep D1 binding `DB`; keep R2 binding `RELEASES` and bucket `xion-assistant-releases`.

```powershell
pnpm --filter @xion-assistant/api exec wrangler secret put JWT_SECRET
pnpm --filter @xion-assistant/api exec wrangler secret put TOKEN_ENCRYPTION_KEY
```

Pages variable: `VITE_PUBLIC_API_URL=https://api.asst.xion.<TU_DOMINIO>`. Assign Pages domain `assistant.xion.<TU_DOMINIO>` and Worker route `api.asst.xion.<TU_DOMINIO>/*`.
