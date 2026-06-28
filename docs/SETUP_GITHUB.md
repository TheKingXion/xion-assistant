# Setup GitHub

Required workflows:

- `test.yml`
- `deploy-api.yml`
- `deploy-web.yml`
- `build-desktop.yml`
- `build-android.yml`
- `publish-release.yml`

Add repository secrets listed in `docs/ENVIRONMENT_VARIABLES.md`.

Do not publish release artifacts without checksum.
