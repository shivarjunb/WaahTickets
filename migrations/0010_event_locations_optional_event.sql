ALTER TABLE event_locations ADD COLUMN created_by TEXT REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_event_locations_created_by ON event_locations(created_by);
