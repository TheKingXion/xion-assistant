# Database

D1 migrations: `workers/api/migrations/0001_initial.sql`, `0002_command_registry.sql` and `0003_admin_and_sessions.sql`.

Personal tables include `user_id` where applicable. This is mandatory for multiuser isolation.

`v0.11.2` API writes users, sessions, assistant messages, contacts, contact aliases, contact channels, assistant memories, voice settings, actions, confirmations, plans and plan steps through a D1 repository when `DB` binding exists. Tests use the in-memory fallback.

Important tables:

- `users`
- `users.is_admin`
- `user_sessions`
- `oauth_accounts`
- `assistant_messages`
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
