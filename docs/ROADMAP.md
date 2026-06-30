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

## v0.9.0

- Shared Google OAuth token helper for Google connectors.
- YouTube search endpoint.
- YouTube subscriptions endpoint.
- Google OAuth default scopes include YouTube readonly.
- Tool registry includes YouTube read metadata.

## v0.10.0

- Command Registry and deterministic router before AI.
- Initial alarm, reminder, app, Spotify, YouTube, update, calendar and communication commands.
- Private shortcuts, learning events and token-saving metrics in D1.
- Verified session auth for Assistant and command endpoints.
- Command action/plan persistence and confirmation policy.
- Web command catalog, shortcut CRUD and usage totals.

## v0.10.1

- Cloudflare setup documentation rewritten in Xion-TV dashboard style.
- D1, R2, Worker, Pages, bindings, secrets, domains, GitHub secrets and validation checklist documented step by step.
- `START_FROM_ZERO.md` now points to the full dashboard deployment flow.

## v0.10.2

- Cloudflare docs clarified as cloud-first production.
- Variables/secrets mapped per Cloudflare Worker and Pages project.
- Future multi-Worker topology documented for API, Voice and Releases.
- D1 `database_id` format corrected to raw UUID without placeholder brackets.

## v0.10.3

- Removed duplicate Worker variable sections from Cloudflare docs.
- Removed placeholder `[[routes]]` and production placeholder vars from `wrangler.toml`.
- Documented Dashboard custom domain setup to prevent `<TU_DOMINIO>` deploy failures.
- Added `.dev.vars.example` for local Worker development variables.

## v0.10.4

- Added Google OAuth dashboard setup for `exiliadosrpv2.uk`.
- Documented exact JavaScript origins and redirect URIs for Google OAuth.
- Documented DNS/custom-domain fix for unresolved API host.

## v0.10.5

- Added `keep_vars = true` to Worker config so `wrangler deploy` preserves dashboard variables.
- Documented recovery steps when Cloudflare build leaves only `JWT_SECRET` and `TOKEN_ENCRYPTION_KEY`.
- Clarified Worker vars stay in dashboard while `wrangler.toml` keeps safe deploy config and bindings.

## v0.10.6

- Rewrote Cloudflare setup as GitHub and `dash.cloudflare.com` only.
- Removed local Wrangler/manual command flow from the official Cloudflare guide.
- Kept D1 migrations, Worker deploy, Pages deploy, bindings, domains and secrets as dashboard steps.

## v0.10.7

- Added dashboard steps to create `CLOUDFLARE_API_TOKEN`.
- Added dashboard steps to find `CLOUDFLARE_ACCOUNT_ID`.
- Linked Cloudflare token values to GitHub Actions secrets without exposing tokens.

## v0.11.0

- Added Google Gemini AI Gateway through the Interactions API.
- Added Gemini TTS provider using `output_audio` wrapped as browser-playable WAV.
- Rebuilt web app as full dashboard: auth, assistant chat, memory, contacts, voice, commands, connectors, updates and settings.
- Made duplicate GitHub deploy workflows manual-only because Cloudflare Dashboard handles deploys on push.

## v0.11.1

- Added Google login/register button in web auth.
- Added `/api/auth/google/start` and `/api/auth/google/callback`.
- Google callback creates or finds the user, creates a Xion session, and stores Google tokens encrypted server-side.
- Documented separate Google callbacks for login/register and app connectors.

## v0.11.2

- Fixed Gemini text/TTS gateway to use `models/{model}:generateContent`.
- Assistant message route now returns JSON errors instead of raw Worker 500s.
- TTS failures no longer block text replies.
- Assistant chat persists messages in D1 `assistant_messages`.
- Added `users.is_admin` migration and `/admin` protected dashboard route.
- Public web root now shows chat/account only.
- Added light/dark theme toggle.

## v0.11.3

- GitHub workflows now read public URLs and R2 bucket name from repository variables.
- GitHub docs now separate repository secrets from repository variables.
- Android, desktop and release workflows document future signing/R2 secrets without requiring them for placeholder builds.

## v0.11.4

- Chat normal now uses one AI text call instead of intent classification plus plan generation.
- Automatic plan cards removed from normal chat replies; action confirmations remain real buttons.
- Added browser microphone input for spoken prompts.
- Assistant replies always attempt audio, but TTS runs after text response so chat latency drops.
- Browser speech synthesis fallback keeps audio available if Worker TTS fails.

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
