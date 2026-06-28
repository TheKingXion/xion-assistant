# Testing

## Commands

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Current Tests

- Shared risk contract.
- Voice gateway mock.
- API health.
- Memory isolation user A/B.
- Voice settings isolation user A/B.
- High risk communication remains pending confirmation.
- Update manifest endpoint.

## Manual Checks

```bash
curl http://localhost:8787/api/health
curl http://localhost:8787/api/voice/voices
curl "http://localhost:8787/api/updates/latest?platform=android&channel=stable"
```

## Workflow Testing

Use PRs for `test.yml`. Deploy workflows need Cloudflare secrets.
