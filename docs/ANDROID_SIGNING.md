# Android Signing

Use this to create GitHub secrets for signed APK builds.

## 1. Create local secret folder

Run in PowerShell from repo root:

```powershell
New-Item -ItemType Directory -Force .secrets | Out-Null
```

## 2. Generate password

```powershell
$Password = [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
$Password
```

Save this value only in GitHub Secret:

```text
ANDROID_KEYSTORE_PASSWORD
```

## 3. Generate keystore

Requires Java `keytool`.

```powershell
$Alias = "xion-assistant"
keytool -genkeypair `
  -v `
  -keystore ".secrets\xion-assistant-upload.keystore" `
  -alias $Alias `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000 `
  -storepass $Password `
  -keypass $Password `
  -dname "CN=Xion Assistant, OU=Xion Scripts, O=Xion Scripts, L=Santiago, S=RM, C=CL"
```

Save this value in GitHub Secret:

```text
ANDROID_KEY_ALIAS=xion-assistant
```

## 4. Convert keystore to base64

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes(".secrets\xion-assistant-upload.keystore")) | Set-Clipboard
```

Paste clipboard into GitHub Secret:

```text
ANDROID_KEYSTORE_BASE64
```

## 5. GitHub location

Path:

```text
GitHub > repo > Settings > Secrets and variables > Actions > Secrets
```

Create:

```text
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
```

Never commit `.secrets/`.

## 6. Release build

Push tag:

```powershell
git tag v0.12.0
git push origin v0.12.0
```

GitHub runs `Build Android`, signs APK, uploads to R2.
