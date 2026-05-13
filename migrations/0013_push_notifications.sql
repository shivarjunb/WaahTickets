-- Push token registry: one row per (user, device token) pair
CREATE TABLE IF NOT EXISTS push_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'expo',
  token TEXT NOT NULL,
  platform TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  app_version TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_push_tokens_user_token ON push_tokens(user_id, token);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);
CREATE INDEX IF NOT EXISTS idx_push_tokens_enabled ON push_tokens(enabled);

-- Campaign: one row per send action initiated by an admin
CREATE TABLE IF NOT EXISTS notification_campaigns (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  event_id TEXT,
  audience_type TEXT NOT NULL DEFAULT 'all',
  created_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_notification_campaigns_created_at ON notification_campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_campaigns_status ON notification_campaigns(status);

-- Delivery: one row per (campaign, token) attempted send
CREATE TABLE IF NOT EXISTS notification_deliveries (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  push_token_id TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  provider_response TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES notification_campaigns(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (push_token_id) REFERENCES push_tokens(id)
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_campaign_id ON notification_deliveries(campaign_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_user_id ON notification_deliveries(user_id);
