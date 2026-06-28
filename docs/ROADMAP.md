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
