PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS partners (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    name TEXT NOT NULL,
    code TEXT,
    partner_type TEXT NOT NULL DEFAULT 'partner',
    parent_partner_id TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (parent_partner_id) REFERENCES partners(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_partners_code ON partners(code);
CREATE INDEX IF NOT EXISTS idx_partners_organization_id ON partners(organization_id);
CREATE INDEX IF NOT EXISTS idx_partners_parent_partner_id ON partners(parent_partner_id);
CREATE INDEX IF NOT EXISTS idx_partners_partner_type ON partners(partner_type);

CREATE TABLE IF NOT EXISTS partner_users (
    id TEXT PRIMARY KEY,
    partner_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (partner_id) REFERENCES partners(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE (partner_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_users_partner_id ON partner_users(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_users_user_id ON partner_users(user_id);

CREATE TABLE IF NOT EXISTS referral_codes (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    partner_id TEXT NOT NULL,
    event_id TEXT,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (partner_id) REFERENCES partners(id),
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_partner_id ON referral_codes(partner_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_event_id ON referral_codes(event_id);

CREATE TABLE IF NOT EXISTS commission_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    event_id TEXT,
    partner_id TEXT,
    referral_code_id TEXT,
    applies_to TEXT NOT NULL,
    commission_type TEXT NOT NULL,
    stacking_group TEXT,
    stacking_behavior TEXT NOT NULL DEFAULT 'stackable',
    priority INTEGER NOT NULL DEFAULT 0,
    commission_source TEXT NOT NULL DEFAULT 'organizer_share',
    rate_value INTEGER,
    flat_amount_paisa INTEGER,
    max_commission_amount_paisa INTEGER,
    max_total_commission_percent_bps INTEGER,
    tier_config_json TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    start_datetime TEXT,
    end_datetime TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (partner_id) REFERENCES partners(id),
    FOREIGN KEY (referral_code_id) REFERENCES referral_codes(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_commission_rules_event_id ON commission_rules(event_id);
CREATE INDEX IF NOT EXISTS idx_commission_rules_partner_id ON commission_rules(partner_id);
CREATE INDEX IF NOT EXISTS idx_commission_rules_referral_code_id ON commission_rules(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_commission_rules_scope ON commission_rules(applies_to, is_active, priority);

CREATE TABLE IF NOT EXISTS commission_ledger (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    beneficiary_type TEXT NOT NULL,
    beneficiary_id TEXT NOT NULL,
    partner_id TEXT,
    referral_code_id TEXT,
    commission_rule_id TEXT,
    commission_type TEXT NOT NULL,
    base_amount_paisa INTEGER NOT NULL DEFAULT 0,
    commission_rate_bps INTEGER,
    commission_amount_paisa INTEGER NOT NULL,
    commission_source TEXT NOT NULL,
    stacking_group TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    entry_type TEXT NOT NULL DEFAULT 'original',
    reverses_ledger_id TEXT,
    refund_id TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (partner_id) REFERENCES partners(id),
    FOREIGN KEY (referral_code_id) REFERENCES referral_codes(id),
    FOREIGN KEY (commission_rule_id) REFERENCES commission_rules(id),
    FOREIGN KEY (reverses_ledger_id) REFERENCES commission_ledger(id)
);

CREATE INDEX IF NOT EXISTS idx_commission_ledger_order_id ON commission_ledger(order_id);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_event_id ON commission_ledger(event_id);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_partner_id ON commission_ledger(partner_id);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_referral_code_id ON commission_ledger(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_beneficiary ON commission_ledger(beneficiary_type, beneficiary_id, status);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_source ON commission_ledger(commission_source, created_at);

CREATE TABLE IF NOT EXISTS refunds (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    payment_id TEXT,
    refund_reference TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    reason TEXT,
    refund_amount_paisa INTEGER NOT NULL DEFAULT 0,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (payment_id) REFERENCES payments(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_created_at ON refunds(created_at);

CREATE TABLE IF NOT EXISTS payout_batches (
    id TEXT PRIMARY KEY,
    batch_type TEXT NOT NULL,
    organization_id TEXT,
    partner_id TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    currency TEXT NOT NULL DEFAULT 'NPR',
    total_amount_paisa INTEGER NOT NULL DEFAULT 0,
    paid_at TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (partner_id) REFERENCES partners(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_payout_batches_status ON payout_batches(status);
CREATE INDEX IF NOT EXISTS idx_payout_batches_org_partner ON payout_batches(organization_id, partner_id);

CREATE TABLE IF NOT EXISTS payout_items (
    id TEXT PRIMARY KEY,
    payout_batch_id TEXT NOT NULL,
    beneficiary_type TEXT NOT NULL,
    beneficiary_id TEXT NOT NULL,
    order_id TEXT,
    event_id TEXT,
    commission_ledger_id TEXT,
    amount_paisa INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    paid_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (payout_batch_id) REFERENCES payout_batches(id),
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (commission_ledger_id) REFERENCES commission_ledger(id)
);

CREATE INDEX IF NOT EXISTS idx_payout_items_batch_id ON payout_items(payout_batch_id);
CREATE INDEX IF NOT EXISTS idx_payout_items_beneficiary ON payout_items(beneficiary_type, beneficiary_id, status);

CREATE TABLE IF NOT EXISTS partner_reporting_permissions (
    id TEXT PRIMARY KEY,
    grantee_partner_id TEXT NOT NULL,
    subject_partner_id TEXT NOT NULL,
    permission_type TEXT NOT NULL,
    expires_at TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (grantee_partner_id) REFERENCES partners(id),
    FOREIGN KEY (subject_partner_id) REFERENCES partners(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    UNIQUE (grantee_partner_id, subject_partner_id, permission_type)
);

CREATE INDEX IF NOT EXISTS idx_partner_reporting_permissions_grantee ON partner_reporting_permissions(grantee_partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_reporting_permissions_subject ON partner_reporting_permissions(subject_partner_id);

CREATE TABLE IF NOT EXISTS report_exports (
    id TEXT PRIMARY KEY,
    report_type TEXT NOT NULL,
    requested_by_user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    filters_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    storage_key TEXT,
    file_url TEXT,
    generated_at TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (requested_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_report_exports_requested_by ON report_exports(requested_by_user_id);
CREATE INDEX IF NOT EXISTS idx_report_exports_status ON report_exports(status);
