ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_assistant_messages_user_created
  ON assistant_messages(user_id, created_at DESC);
