# Database

D1 migrations: `workers/api/migrations/0001_initial.sql` and `0002_command_registry.sql`.

Personal tables include `user_id` where applicable. This is mandatory for multiuser isolation.

`v0.3.0` API writes users, sessions, contacts, contact aliases, contact channels, assistant memories, voice settings, actions, confirmations, plans and plan steps through a D1 repository when `DB` binding exists. Tests use the in-memory fallback.

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
- `command_definitions`
- `user_command_shortcuts`
- `command_usage_events`
- `command_learning_events`
