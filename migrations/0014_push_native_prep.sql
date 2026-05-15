-- Phase 1 prep for native-capable push providers and rich-media campaigns.
ALTER TABLE push_tokens ADD COLUMN device_id TEXT;
ALTER TABLE push_tokens ADD COLUMN app_bundle_id TEXT;
ALTER TABLE push_tokens ADD COLUMN environment TEXT;
ALTER TABLE push_tokens ADD COLUMN last_seen_at TEXT;

ALTER TABLE notification_campaigns ADD COLUMN image_url TEXT;

CREATE INDEX IF NOT EXISTS idx_push_tokens_provider ON push_tokens(provider);
CREATE INDEX IF NOT EXISTS idx_push_tokens_platform ON push_tokens(platform);
