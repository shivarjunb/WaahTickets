CREATE TABLE IF NOT EXISTS guest_checkout_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_guest_checkout_sessions_user_id
  ON guest_checkout_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_guest_checkout_sessions_email
  ON guest_checkout_sessions(email);

CREATE INDEX IF NOT EXISTS idx_guest_checkout_sessions_expires_at
  ON guest_checkout_sessions(expires_at);
