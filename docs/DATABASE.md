# Database

D1 migration: `workers/api/migrations/0001_initial.sql`.

Personal tables include `user_id` where applicable. This is mandatory for multiuser isolation.

`v0.2.0` API writes users, sessions, assistant memories, voice settings, actions, confirmations, plans and plan steps through a D1 repository when `DB` binding exists. Tests use the in-memory fallback.

Important tables:

- `users`
- `user_sessions`
- `oauth_accounts`
- `assistant_memories`
- `contacts`
- `assistant_actions`
- `action_confirmations`
- `assistant_plans`
- `voice_settings`
- `available_voices`
- `app_versions`
- `ai_usage`
