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
```
