# D1 Migrations

Local:

```bash
pnpm --filter @xion-assistant/api exec wrangler d1 migrations apply xion-assistant --local
```

Remote:

```bash
pnpm --filter @xion-assistant/api exec wrangler d1 migrations apply xion-assistant --remote
```

Never edit an applied migration in production. Add a new migration.
