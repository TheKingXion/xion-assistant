# R2 Releases

Bucket:

```text
xion-assistant-releases
```

Expected layout:

```text
/desktop/windows/
/mobile/android/
/mobile/android/latest.json
/checksums.json
```

Generate checksums before upload:

```bash
pnpm release:checksums dist/releases dist/releases/checksums.json
```

Android workflow uploads:

```text
mobile/android/xion-assistant-<version>.apk
mobile/android/latest.json
checksums.json
```

Worker API serves files with:

```text
GET /releases/*
```
