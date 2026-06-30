# Updates

## Build Outputs

Planned R2 layout:

- `/desktop/windows/xion-assistant-setup-<version>.exe`
- `/mobile/android/xion-assistant-<version>.apk`
- `/mobile/android/latest.json`
- `/checksums.json`

## Endpoint

```text
GET /api/updates/latest?platform=windows&arch=x64&channel=stable
GET /api/updates/latest?platform=android&channel=stable
```

Android download URL is proxied by Worker:

```text
GET /releases/mobile/android/xion-assistant-<version>.apk
```

## Checksum

```bash
pnpm release:checksums dist/releases dist/releases/checksums.json
```

## Publish Gate

```bash
pnpm release:verify dist/releases/latest.json
```

The verifier rejects placeholder sha256.

## Failure Handling

If download fails, app keeps current version. If checksum differs, app deletes downloaded file and refuses install.
