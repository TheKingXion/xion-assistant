# Roadmap

## v0.0.1

- Monorepo.
- Worker API.
- D1 schema.
- Auth foundation.
- Web console foundation.
- Memory per user foundation.
- Voice settings and TTS mock.
- Update manifest endpoint.
- Tests and workflows.
- Required docs.

## v0.0.2

- Local Wrangler dev host fixed for placeholder production routes.

## v0.1.0

- D1-backed repositories for users, memory and voice settings.
- Async repository interface with in-memory fallback for tests/local calls without DB.
- Real auth/session persistence in D1 remains next.
- Full CRUD memory/contact remains next.
- Action confirmations and assistant plans persistence remain next.

## v0.2.0

- Session metadata persisted for register/login.
- Memory update/delete endpoints with `user_id` ownership guard.
- Assistant actions persisted for high-risk message flow.
- Action confirmation/cancel endpoints persist decisions.
- Confirmation does not fake connector execution; missing connector marks action failed with explicit reason.
- Assistant plans and steps persisted and readable by owner only.

## v0.3.0

- Contacts persisted through repository.
- Contact aliases and channels persisted per user.
- Contact resolver prevents cross-user alias leakage.
- Communication Router prepares recipient/channel/message without external sends.
- Assistant engine resolves `mi esposa` through contacts and preferred channels before memory fallback.

## v0.4.0

- AI Gateway interface added.
- Mock AI Gateway supports generateText, classifyIntent, extractEntities, summarize and createActionPlan.
- Assistant classify/plan endpoints added.
- Tool registry added with risk/auth/confirmation metadata.
- Assistant Engine now includes AI usage metadata in generated plans.

## v0.5.0

- OAuth provider URL builder for Google and Spotify.
- OAuth callback guard with explicit token exchange pending state.
- AES-GCM token encryption helpers.
- OAuth account persistence through repository.
- Redacted connected-account listing by `user_id`.
- OAuth disconnect endpoint.

## v0.6.0

- OAuth callback exchanges authorization codes for tokens.
- Google user id resolved from `id_token` or userinfo.
- Spotify user id resolved from `/v1/me`.
- Exchanged tokens are encrypted before repository storage.
- Missing provider secrets return explicit non-success error.

## v0.7.0

- Internal OAuth secret retrieval for connectors.
- Google Calendar list events endpoint.
- Google Calendar create event prepares pending action.
- Action confirmation executes `calendar.create_event` only after explicit confirmation.
- Tool registry includes calendar list/create metadata.

## v0.8.0

- Spotify current playback endpoint.
- Spotify play endpoint prepares pending action.
- Spotify pause endpoint prepares pending action.
- Action confirmation executes `spotify.play` and `spotify.pause` only after explicit confirmation.
- Tool registry includes Spotify playback metadata.

## v0.2.0

- Google OAuth.
- Google Calendar.
- YouTube connector.
- Spotify OAuth and playback controls.

## v0.3.0

- Real AI Gateway provider.
- Real TTS provider.
- Real STT provider.
- Voice preview and playback in web.

## v0.4.0

- Tauri desktop app.
- Windows installer.
- Tauri updater.
- Tray and global shortcut.

## v0.5.0

- Expo Android app.
- APK build/signing.
- In-app updater from R2.

## v0.6.0

- Wake word local.
- Privacy mode.
- Per-device voice rules.

## v1.0.0

- Production security hardening.
- Admin panel.
- Usage limits.
- Full release automation.
