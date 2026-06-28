CREATE TABLE IF NOT EXISTS command_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  requires_confirmation INTEGER NOT NULL DEFAULT 0,
  is_system INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_command_shortcuts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shortcut TEXT NOT NULL COLLATE NOCASE,
  intent TEXT NOT NULL,
  params_json TEXT NOT NULL DEFAULT '{}',
  confidence REAL NOT NULL DEFAULT 1 CHECK (confidence >= 0 AND confidence <= 1),
  confirmed INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, shortcut)
);

CREATE INDEX IF NOT EXISTS idx_user_command_shortcuts_lookup ON user_command_shortcuts(user_id, shortcut, confirmed, is_active);

CREATE TABLE IF NOT EXISTS command_usage_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  command_name TEXT,
  input_text TEXT NOT NULL,
  matched_pattern TEXT,
  confidence REAL NOT NULL DEFAULT 0,
  used_ai_fallback INTEGER NOT NULL DEFAULT 0,
  estimated_tokens_saved INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_command_usage_user_created ON command_usage_events(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS command_learning_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_text TEXT NOT NULL,
  suggested_shortcut TEXT NOT NULL,
  intent TEXT NOT NULL,
  params_json TEXT NOT NULL DEFAULT '{}',
  confirmed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_command_learning_user_created ON command_learning_events(user_id, created_at DESC);
