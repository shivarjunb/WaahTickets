-- Add multi-redemption coupon support for databases where 0016 was already applied.
-- Existing coupons remain single-use; new FCFS coupons can set max_redemptions > 1.

ALTER TABLE coupons ADD COLUMN redemption_type TEXT NOT NULL DEFAULT 'single_use';

CREATE INDEX IF NOT EXISTS idx_coupons_redemption_type ON coupons(redemption_type);

PRAGMA foreign_keys = OFF;

CREATE TABLE coupon_redemptions_0017_backup AS
SELECT
    id,
    coupon_id,
    order_id,
    customer_id,
    discount_amount_paisa,
    redeemed_at
FROM coupon_redemptions;

DROP TABLE coupon_redemptions;

CREATE TABLE coupon_redemptions (
    id TEXT PRIMARY KEY,
    coupon_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    discount_amount_paisa INTEGER NOT NULL DEFAULT 0,
    redeemed_at TEXT NOT NULL,
    FOREIGN KEY (coupon_id) REFERENCES coupons(id),
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (customer_id) REFERENCES users(id)
);

INSERT INTO coupon_redemptions (
    id,
    coupon_id,
    order_id,
    customer_id,
    discount_amount_paisa,
    redeemed_at
)
SELECT
    id,
    coupon_id,
    order_id,
    customer_id,
    discount_amount_paisa,
    redeemed_at
FROM coupon_redemptions_0017_backup
WHERE
    EXISTS (SELECT 1 FROM coupons c WHERE c.id = coupon_redemptions_0017_backup.coupon_id) AND
    EXISTS (SELECT 1 FROM orders o WHERE o.id = coupon_redemptions_0017_backup.order_id) AND
    EXISTS (SELECT 1 FROM users u WHERE u.id = coupon_redemptions_0017_backup.customer_id);

DROP TABLE coupon_redemptions_0017_backup;

PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon_id ON coupon_redemptions(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_order_id ON coupon_redemptions(order_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_customer_id ON coupon_redemptions(customer_id);
