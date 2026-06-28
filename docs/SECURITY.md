# Security

## Auth

`v0.2.0` has basic email/password endpoints backed by repository persistence and session metadata. Passwords are hashed. Production should replace SHA-256 placeholder with stronger password hashing supported by target runtime.

## Sessions

Session token foundation exists. Production needs refresh tokens, revocation and device tracking wired to D1.

## OAuth

Google/Spotify OAuth start URLs, callback token exchange and encrypted token storage exist. Missing provider secrets fail closed.

## Token Encryption

OAuth tokens are encrypted with AES-GCM using `TOKEN_ENCRYPTION_KEY`. API list responses are redacted and must never return access/refresh tokens.

## Confirmations

High risk actions require explicit confirmation. Tests verify message send starts `pending_confirmation`. Confirming without a configured connector records the confirmation and marks the action failed with `connector_not_configured`, not completed.

## Rate Limiting And Turnstile

Planned. Login/register/recovery should use Turnstile before production.

## User Isolation

Every personal table has `user_id` where applicable. Tests cover memory and voice settings isolation.

## Logs

Do not log full private messages, tokens or private audio.

## Data Deletion

Account, memory and history deletion endpoints are pending.
