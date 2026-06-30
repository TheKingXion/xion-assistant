# Setup GitHub

Workflows:

- `test.yml`
- `deploy-api.yml`
- `deploy-web.yml`
- `build-desktop.yml`
- `build-android.yml`
- `publish-release.yml`

Add repository secrets listed in `docs/ENVIRONMENT_VARIABLES.md`.

`deploy-api.yml` and `deploy-web.yml` are manual-only because Cloudflare Dashboard Git integration deploys API and Pages on push. This avoids duplicate failing checks when Cloudflare already deployed successfully.

Do not publish release artifacts without checksum.
