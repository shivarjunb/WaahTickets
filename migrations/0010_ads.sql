PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ad_settings (
  id TEXT PRIMARY KEY,
  ads_enabled INTEGER NOT NULL DEFAULT 1,
  web_ads_enabled INTEGER NOT NULL DEFAULT 1,
  mobile_ads_enabled INTEGER NOT NULL DEFAULT 1,
  default_ad_frequency INTEGER NOT NULL DEFAULT 3,
  max_ads_per_page INTEGER NOT NULL DEFAULT 3,
  fallback_ad_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  FOREIGN KEY (updated_by) REFERENCES users(id),
  FOREIGN KEY (fallback_ad_id) REFERENCES ads(id)
);

CREATE TABLE IF NOT EXISTS ads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  advertiser_name TEXT NOT NULL,
  placement TEXT NOT NULL,
  device_target TEXT NOT NULL,
  image_url TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT,
  status TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  display_frequency INTEGER,
  max_impressions INTEGER,
  max_clicks INTEGER,
  open_in_new_tab INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (updated_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS ad_impressions (
  id TEXT PRIMARY KEY,
  ad_id TEXT NOT NULL,
  placement TEXT NOT NULL,
  device_type TEXT NOT NULL,
  page_url TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ad_clicks (
  id TEXT PRIMARY KEY,
  ad_id TEXT NOT NULL,
  placement TEXT NOT NULL,
  device_type TEXT NOT NULL,
  page_url TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ads_placement_status_device_priority
  ON ads(placement, status, device_target, priority DESC, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad_id_created_at
  ON ad_impressions(ad_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ad_clicks_ad_id_created_at
  ON ad_clicks(ad_id, created_at DESC);

INSERT INTO ad_settings (
  id,
  ads_enabled,
  web_ads_enabled,
  mobile_ads_enabled,
  default_ad_frequency,
  max_ads_per_page,
  fallback_ad_id,
  created_at,
  updated_at,
  updated_by
)
SELECT
  'default',
  1,
  1,
  1,
  3,
  3,
  NULL,
  datetime('now'),
  datetime('now'),
  NULL
WHERE NOT EXISTS (SELECT 1 FROM ad_settings WHERE id = 'default');
