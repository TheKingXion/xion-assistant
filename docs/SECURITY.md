# Security

## Auth

`v0.0.1` has basic email/password endpoints for local foundation. Passwords are hashed. Production should replace SHA-256 placeholder with stronger password hashing supported by target runtime.

## Sessions

Session token foundation exists. Production needs refresh tokens, revocation and device tracking wired to D1.

## OAuth

Tables and secrets are prepared. Google/Spotify OAuth flows are pending.

## Token Encryption

OAuth tokens must be encrypted using `TOKEN_ENCRYPTION_KEY`. Never log tokens.

## Confirmations

High risk actions require explicit confirmation. Tests verify message send stays `pending_confirmation`.

## Rate Limiting And Turnstile

Planned. Login/register/recovery should use Turnstile before production.

## User Isolation

Every personal table has `user_id` where applicable. Tests cover memory and voice settings isolation.

## Logs

Do not log full private messages, tokens or private audio.

## Data Deletion

Account, memory and history deletion endpoints are pending.
