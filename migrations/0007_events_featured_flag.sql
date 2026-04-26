PRAGMA foreign_keys = ON;

ALTER TABLE events ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_events_is_featured ON events(is_featured);
