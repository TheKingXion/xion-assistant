# YouTube Connector

`v0.9.0` adds read-only YouTube endpoints through the connected Google OAuth account.

## Search Videos

```bash
GET /api/google/youtube/search?user_id=<USER_ID>&q=<QUERY>
```

Optional:

```bash
max_results=10
```

## List Subscriptions

```bash
GET /api/google/youtube/subscriptions?user_id=<USER_ID>
```

Optional:

```bash
max_results=10
```

## OAuth Scope

Google OAuth default scopes include:

```text
https://www.googleapis.com/auth/youtube.readonly
```

## Security

The connector decrypts the Google access token only inside the Worker. YouTube endpoints are read-only in this version and do not create confirmation actions.
