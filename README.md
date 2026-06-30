# Xion Assistant

Xion Assistant is a professional multiuser personal assistant base: Cloudflare Worker API, D1 schema, React web panel, voice settings, action confirmations, update manifests, tests, workflows, and required setup documentation.

Version `v0.11.4` is a foundation, not the complete final assistant. It adds authenticated Command Registry routing before AI, private shortcuts, usage metrics, confirmation-safe actions, a user chat/account surface, admin-only dashboard route, Google login/register, persisted assistant messages, microphone input, non-blocking TTS replies, light/dark theme, Google Gemini text/TTS gateway support through `generateContent`, GitHub Actions variable/secret separation, GitHub/Dashboard-only Cloudflare deployment docs, and `keep_vars = true` so Worker deploys do not wipe dashboard variables. Desktop/mobile installers, STT implementation, R2 uploads, and production releases remain documented next phases.

## Stack

- TypeScript monorepo with pnpm workspaces.
- Cloudflare Workers + Hono API.
- Cloudflare D1 migrations.
- Cloudflare R2-ready release scripts.
- React + Vite + TailwindCSS web app.
- Vitest for API and shared package tests.

## Local Run

```bash
pnpm install
pnpm dev:api
pnpm dev:web
```

API placeholder route: `https://api.asst.xion.<TU_DOMINIO>`

Web placeholder route: `https://assistant.xion.<TU_DOMINIO>`

## Test And Build

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Documentation

- [Start from zero](docs/START_FROM_ZERO.md)
- [Cloudflare dashboard setup](docs/SETUP_CLOUDFLARE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Domain routes](docs/SETUP_DOMAIN_ROUTES.md)
- [Google OAuth dashboard](docs/GOOGLE_OAUTH_DASHBOARD.md)
- [Environment variables](docs/ENVIRONMENT_VARIABLES.md)
- [Security](docs/SECURITY.md)
- [Testing](docs/TESTING.md)
- [Roadmap](docs/ROADMAP.md)
