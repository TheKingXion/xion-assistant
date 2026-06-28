# R2 Releases

Bucket:

```text
xion-assistant-releases
```

Expected layout:

```text
/desktop/windows/
/mobile/android/
/latest/
/checksums/
/changelogs/
```

Generate checksums before upload:

```bash
pnpm release:checksums dist/releases dist/releases/checksums.json
```
