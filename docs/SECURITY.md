# Security

## Auth

`v0.2.0` has basic email/password endpoints backed by repository persistence and session metadata. Passwords are hashed. Production should replace SHA-256 placeholder with stronger password hashing supported by target runtime.

## Sessions

Assistant and Command Registry endpoints verify HMAC token signature, expiry and persisted active-session hash. Server derives `user_id`; protected request bodies cannot select another owner. Refresh-token rotation and explicit device revocation remain future hardening.

Browser API uses Bearer headers, not cookies. CORS allows origins without credential mode; possession of a valid persisted session token remains required for protected routes.

## OAuth

Google login/register uses `/api/auth/google/start` and `/api/auth/google/callback`. The callback creates or finds the user by Google email, creates a Xion session, stores Google tokens encrypted server-side, then redirects to the web with a short `#auth=...` hash payload. Google/Spotify connector OAuth start URLs, callback token exchange and encrypted token storage also exist. Missing provider secrets fail closed.

## Token Encryption

OAuth tokens are encrypted with AES-GCM using `TOKEN_ENCRYPTION_KEY`. API list responses are redacted and must never return access/refresh tokens.

## Confirmations

High-risk communication, calendar writes, ambiguous alarm cancellation and repeating alarms require confirmation. Optimized commands still persist actions and plans.

## Command Isolation

Shortcuts, learning events and usage metrics filter by authenticated `user_id`. Cross-user update/delete returns `404`. System patterns live in reviewed TypeScript; D1 never supplies executable regex. Logs contain command metadata, not secrets or OAuth tokens.

High risk actions require explicit confirmation. Tests verify message send starts `pending_confirmation`. Confirming without a configured connector records the confirmation and marks the action failed with `connector_not_configured`, not completed.

## Rate Limiting And Turnstile

Planned. Login/register/recovery should use Turnstile before production.

## User Isolation

Every personal table has `user_id` where applicable. Tests cover memory and voice settings isolation.

## Logs

Do not log full private messages, tokens or private audio.

## Data Deletion

Account, memory and history deletion endpoints are pending.
