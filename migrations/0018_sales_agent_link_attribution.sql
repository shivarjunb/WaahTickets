-- Track sales-agent link attribution and optionally attach FCFS coupons to links.

ALTER TABLE referral_codes ADD COLUMN linked_coupon_id TEXT REFERENCES coupons(id);

ALTER TABLE orders ADD COLUMN partner_id TEXT REFERENCES partners(id);
ALTER TABLE orders ADD COLUMN referral_code_id TEXT REFERENCES referral_codes(id);
ALTER TABLE orders ADD COLUMN attribution_source TEXT;

CREATE INDEX IF NOT EXISTS idx_referral_codes_linked_coupon_id ON referral_codes(linked_coupon_id);
CREATE INDEX IF NOT EXISTS idx_orders_partner_id ON orders(partner_id);
CREATE INDEX IF NOT EXISTS idx_orders_referral_code_id ON orders(referral_code_id);
