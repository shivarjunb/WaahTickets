PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id
    ON email_verification_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at
    ON email_verification_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_used_at
    ON email_verification_tokens(used_at);
