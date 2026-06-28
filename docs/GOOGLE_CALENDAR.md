# Google Calendar

`v0.7.0` adds first Google Calendar connector flow.

## List Events

```text
GET /api/google/calendar/events?user_id=<USER_ID>
```

Requires connected Google OAuth account with encrypted access token.

## Create Event

```text
POST /api/google/calendar/events
```

Body:

```json
{
  "userId": "user-a",
  "summary": "Reunion",
  "start": "2026-06-29T10:00:00-04:00",
  "end": "2026-06-29T11:00:00-04:00"
}
```

This prepares `calendar.create_event` as `pending_confirmation`. It does not call Google until:

```text
POST /api/actions/<ACTION_ID>/confirm
```

## Security

Access tokens are decrypted only inside the Worker connector. Tokens are never returned by API responses.
