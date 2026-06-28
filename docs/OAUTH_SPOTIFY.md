# Spotify OAuth

Status: foundation added in `v0.5.0`. Authorization URL generation and encrypted token storage exist. Real token exchange remains pending.

Redirect:

```text
https://api.asst.xion.<TU_DOMINIO>/api/oauth/spotify/callback
```

Secrets:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`

Tokens must be encrypted server-side.

Start URL:

```text
GET /api/oauth/spotify/start?user_id=<USER_ID>
```
