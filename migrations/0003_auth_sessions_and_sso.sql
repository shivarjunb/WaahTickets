PRAGMA foreign_keys = ON;

ALTER TABLE users ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'password';
ALTER TABLE users ADD COLUMN google_sub TEXT;
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN last_login_at TEXT;

CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL DEFAULT 'password',
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON auth_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub);
