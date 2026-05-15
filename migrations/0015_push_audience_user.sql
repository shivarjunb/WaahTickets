ALTER TABLE notification_campaigns ADD COLUMN audience_user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_notification_campaigns_audience_user_id
ON notification_campaigns(audience_user_id);
