# Google OAuth

Status: foundation added in `v0.5.0`. Authorization URL generation and encrypted token storage exist. Real token exchange remains pending.

Redirect:

```text
https://api.asst.xion.<TU_DOMINIO>/api/oauth/google/callback
```

Secrets:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Tokens must be encrypted server-side.

Start URL:

```text
GET /api/oauth/google/start?user_id=<USER_ID>
```

Connected accounts:

```text
GET /api/oauth/accounts?user_id=<USER_ID>
```
