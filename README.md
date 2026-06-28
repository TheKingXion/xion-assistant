# Xion Assistant

Xion Assistant is a professional multiuser personal assistant base: Cloudflare Worker API, D1 schema, React web panel, voice settings, action confirmations, update manifests, tests, workflows, and required setup documentation.

Version `v0.1.0` is a foundation, not the complete final assistant. It implements the first executable slice plus D1-backed persistence for users, memory and voice settings. OAuth providers, desktop/mobile installers, real TTS/STT providers, R2 uploads, and production deployments remain documented next phases.

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
- [Architecture](docs/ARCHITECTURE.md)
- [Domain routes](docs/SETUP_DOMAIN_ROUTES.md)
- [Environment variables](docs/ENVIRONMENT_VARIABLES.md)
- [Security](docs/SECURITY.md)
- [Testing](docs/TESTING.md)
- [Roadmap](docs/ROADMAP.md)
