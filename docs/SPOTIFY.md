# Spotify Connector

`v0.8.0` adds the first Spotify playback connector flow.

## Read Playback

```bash
GET /api/spotify/player?user_id=<USER_ID>
```

Returns the current Spotify player state for the connected user. If Spotify returns no active player, `playback` is `null`.

## Play

```bash
POST /api/spotify/player/play
```

Body:

```json
{
  "userId": "user-a",
  "deviceId": "optional-device-id",
  "uris": ["spotify:track:..."],
  "contextUri": "spotify:playlist:..."
}
```

This prepares `spotify.play` as `pending_confirmation`. It does not call Spotify until:

```bash
POST /api/actions/<ACTION_ID>/confirm
```

## Pause

```bash
POST /api/spotify/player/pause
```

Body:

```json
{
  "userId": "user-a",
  "deviceId": "optional-device-id"
}
```

This prepares `spotify.pause` as `pending_confirmation`.

## Security

Access tokens are decrypted only inside the Worker connector. Tokens are never returned by API responses. Playback mutations require explicit confirmation before the outbound Spotify API call.
