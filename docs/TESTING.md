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
- Confirming a message action records confirmation but does not fake external connector execution.
- Plans are readable by owner only.
- Memory update/delete requires owning `user_id`.
- Contact aliases resolve only for owning user.
- Assistant message flow uses preferred contact channel before memory fallback.
- AI Gateway mock classifies high-risk send-message requests.
- Tool registry exposes confirmation metadata.
- Update manifest endpoint.
- Repository abstraction uses D1 when `DB` binding exists and in-memory fallback during tests.

## Manual Checks

```bash
curl http://localhost:8787/api/health
curl http://localhost:8787/api/voice/voices
curl "http://localhost:8787/api/updates/latest?platform=android&channel=stable"
```

## Workflow Testing

Use PRs for `test.yml`. Deploy workflows need Cloudflare secrets.
