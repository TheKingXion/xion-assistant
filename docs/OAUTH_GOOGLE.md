# Google OAuth

Status: login/register with Google added in `v0.11.1`. Connector OAuth foundation exists since `v0.6.0`. Authorization URL generation, callback exchange, provider user id resolution, encrypted token storage and redacted account listing exist.

Dashboard step-by-step for current domain:

```text
docs/GOOGLE_OAUTH_DASHBOARD.md
```

Login/register redirect:

```text
https://api.asst.xion.<TU_DOMINIO>/api/auth/google/callback
```

Connector redirect:

```text
https://api.asst.xion.<TU_DOMINIO>/api/oauth/google/callback
```

Secrets:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Tokens must be encrypted server-side.

Start URL:

```text
GET /api/auth/google/start
```

This creates a Xion session. If the Google email does not exist, the backend creates the user. The session payload returns to the web in URL hash `#auth=...`; access and refresh tokens stay server-side and encrypted.

Connector start URL:

```text
GET /api/oauth/google/start?user_id=<USER_ID>
```

Connected accounts:

```text
GET /api/oauth/accounts?user_id=<USER_ID>
```

Callback:

```text
GET /api/oauth/google/callback?code=<CODE>&state=<STATE>
```

Calendar events:

```text
GET /api/google/calendar/events?user_id=<USER_ID>
POST /api/google/calendar/events
```

Creating an event returns a pending action. Confirm through `/api/actions/:id/confirm`.
