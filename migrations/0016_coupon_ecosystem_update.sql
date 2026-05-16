-- Coupon ecosystem overhaul:
-- - one globally redeemable coupon per checkout
-- - organizer and Waah coupon types with typed public codes
-- - optional event scope on either coupon type
-- - event-scoped coupons expire at event end; unscoped coupons default to 5 years

PRAGMA foreign_keys = OFF;

CREATE TABLE coupons_new (
    id TEXT PRIMARY KEY,
    coupon_type TEXT NOT NULL DEFAULT 'organizer',
    public_code TEXT NOT NULL UNIQUE,
    qr_payload TEXT UNIQUE,
    event_id TEXT,
    organization_id TEXT,
    code TEXT NOT NULL,
    description TEXT,
    discount_type TEXT NOT NULL,
    discount_amount_paisa INTEGER,
    discount_percentage REAL,
    max_redemptions INTEGER NOT NULL DEFAULT 1,
    redeemed_count INTEGER NOT NULL DEFAULT 0,
    min_order_amount_paisa INTEGER,
    start_datetime TEXT,
    end_datetime TEXT,
    expires_at TEXT NOT NULL,
    issued_by_user_id TEXT,
    issued_at TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (issued_by_user_id) REFERENCES users(id)
);

INSERT INTO coupons_new (
    id,
    coupon_type,
    public_code,
    qr_payload,
    event_id,
    organization_id,
    code,
    description,
    discount_type,
    discount_amount_paisa,
    discount_percentage,
    max_redemptions,
    redeemed_count,
    min_order_amount_paisa,
    start_datetime,
    end_datetime,
    expires_at,
    issued_at,
    is_active,
    created_at,
    updated_at
)
SELECT
    coupons.id,
    'organizer',
    'ORG-' || upper(replace(replace(coupons.code, ' ', '-'), '_', '-')) || '-' || upper(substr(replace(coupons.id, '-', ''), 1, 8)),
    'waahcoupon:v1:ORG-' || upper(replace(replace(coupons.code, ' ', '-'), '_', '-')) || '-' || upper(substr(replace(coupons.id, '-', ''), 1, 8)),
    coupons.event_id,
    events.organization_id,
    upper(replace(replace(coupons.code, ' ', '-'), '_', '-')) || '-' || upper(substr(replace(coupons.id, '-', ''), 1, 8)),
    coupons.description,
    coupons.discount_type,
    coupons.discount_amount_paisa,
    coupons.discount_percentage,
    1,
    CASE WHEN EXISTS (SELECT 1 FROM coupon_redemptions WHERE coupon_redemptions.coupon_id = coupons.id) THEN 1 ELSE 0 END,
    coupons.min_order_amount_paisa,
    coupons.start_datetime,
    coupons.end_datetime,
    COALESCE(coupons.end_datetime, datetime(COALESCE(coupons.created_at, 'now'), '+5 years')),
    COALESCE(coupons.created_at, datetime('now')),
    COALESCE(coupons.is_active, 1),
    COALESCE(coupons.created_at, datetime('now')),
    COALESCE(coupons.updated_at, coupons.created_at, datetime('now'))
FROM coupons
LEFT JOIN events ON events.id = coupons.event_id;

DROP TABLE coupons;
ALTER TABLE coupons_new RENAME TO coupons;

CREATE TABLE coupon_redemptions_new (
    id TEXT PRIMARY KEY,
    coupon_id TEXT NOT NULL UNIQUE,
    order_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    discount_amount_paisa INTEGER NOT NULL DEFAULT 0,
    redeemed_at TEXT NOT NULL,
    FOREIGN KEY (coupon_id) REFERENCES coupons(id),
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (customer_id) REFERENCES users(id)
);

INSERT INTO coupon_redemptions_new (
    id,
    coupon_id,
    order_id,
    customer_id,
    discount_amount_paisa,
    redeemed_at
)
SELECT
    'red-' || lower(hex(randomblob(16))),
    coupon_id,
    MIN(order_id),
    MIN(customer_id),
    SUM(discount_amount_paisa),
    MIN(redeemed_at)
FROM coupon_redemptions
GROUP BY coupon_id;

DROP TABLE coupon_redemptions;
ALTER TABLE coupon_redemptions_new RENAME TO coupon_redemptions;

PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS idx_coupons_event_id ON coupons(event_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_code_unique ON coupons(lower(code));
CREATE INDEX IF NOT EXISTS idx_coupons_public_code ON coupons(public_code);
CREATE INDEX IF NOT EXISTS idx_coupons_qr_payload ON coupons(qr_payload);
CREATE INDEX IF NOT EXISTS idx_coupons_coupon_type ON coupons(coupon_type);
CREATE INDEX IF NOT EXISTS idx_coupons_organization_id ON coupons(organization_id);
CREATE INDEX IF NOT EXISTS idx_coupons_expires_at ON coupons(expires_at);
CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON coupons(is_active);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon_id ON coupon_redemptions(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_order_id ON coupon_redemptions(order_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_customer_id ON coupon_redemptions(customer_id);
