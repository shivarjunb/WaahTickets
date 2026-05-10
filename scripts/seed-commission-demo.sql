PRAGMA foreign_keys = ON;

DELETE FROM payout_items
WHERE id IN (
  'demo-payout-item-organizer-kathmandu',
  'demo-payout-item-organizer-pokhara',
  'demo-payout-item-abc-event1',
  'demo-payout-item-abc-override-event1',
  'demo-payout-item-rita-event1',
  'demo-payout-item-wavepass-event2',
  'demo-payout-item-nima-event2'
);

DELETE FROM payout_batches
WHERE id IN (
  'demo-payout-batch-organizer-kathmandu',
  'demo-payout-batch-organizer-pokhara',
  'demo-payout-batch-partner-abc',
  'demo-payout-batch-partner-rita',
  'demo-payout-batch-partner-wavepass',
  'demo-payout-batch-partner-nima'
);

DELETE FROM report_exports
WHERE id IN ('demo-report-export-admin-summary');

DELETE FROM partner_reporting_permissions
WHERE id IN ('demo-permission-abc-view-rita');

DELETE FROM commission_ledger
WHERE id IN (
  'demo-ledger-order1-abc-main',
  'demo-ledger-order1-rita-referral',
  'demo-ledger-order1-abc-override',
  'demo-ledger-order1-platform-fee',
  'demo-ledger-order1-gateway-fee',
  'demo-ledger-order2-abc-main',
  'demo-ledger-order2-platform-fee',
  'demo-ledger-order2-gateway-fee',
  'demo-ledger-order3-wavepass-main',
  'demo-ledger-order3-nima-referral',
  'demo-ledger-order3-wavepass-override',
  'demo-ledger-order3-platform-fee',
  'demo-ledger-order3-gateway-fee',
  'demo-ledger-order4-wavepass-main',
  'demo-ledger-order4-nima-referral',
  'demo-ledger-order4-wavepass-override',
  'demo-ledger-order4-platform-fee',
  'demo-ledger-order4-gateway-fee',
  'demo-ledger-order4-wavepass-main-reversal',
  'demo-ledger-order4-nima-referral-reversal',
  'demo-ledger-order4-wavepass-override-reversal',
  'demo-ledger-order4-platform-fee-reversal',
  'demo-ledger-order4-gateway-fee-reversal'
);

DELETE FROM refunds
WHERE id IN ('demo-refund-order4-full');

DELETE FROM coupon_redemptions
WHERE id IN ('demo-coupon-redemption-order2');

DELETE FROM payments
WHERE id IN (
  'demo-payment-order1',
  'demo-payment-order2',
  'demo-payment-order3',
  'demo-payment-order4'
);

DELETE FROM order_items
WHERE id IN (
  'demo-order-item-1-vip',
  'demo-order-item-2-ga',
  'demo-order-item-3-weekender',
  'demo-order-item-4-sunset'
);

DELETE FROM orders
WHERE id IN (
  'demo-order-1',
  'demo-order-2',
  'demo-order-3',
  'demo-order-4'
);

DELETE FROM commission_rules
WHERE id IN (
  'demo-rule-kathmandu-platform-fee',
  'demo-rule-kathmandu-abc-main',
  'demo-rule-kathmandu-rita-referral',
  'demo-rule-kathmandu-abc-override',
  'demo-rule-pokhara-platform-fee',
  'demo-rule-pokhara-wavepass-main',
  'demo-rule-pokhara-nima-referral',
  'demo-rule-pokhara-wavepass-override'
);

DELETE FROM referral_codes
WHERE id IN (
  'demo-referral-rita-kathmandu',
  'demo-referral-nima-pokhara'
);

DELETE FROM partner_users
WHERE id IN (
  'demo-partner-user-abc',
  'demo-partner-user-wavepass'
);

DELETE FROM partners
WHERE id IN (
  'demo-partner-abc',
  'demo-partner-rita',
  'demo-partner-wavepass',
  'demo-partner-nima'
);

DELETE FROM coupons
WHERE id IN ('demo-coupon-rooftop-earlybird');

DELETE FROM ticket_types
WHERE id IN (
  'demo-ticket-kathmandu-vip',
  'demo-ticket-kathmandu-ga',
  'demo-ticket-pokhara-weekender',
  'demo-ticket-pokhara-sunset'
);

DELETE FROM event_locations
WHERE id IN (
  'demo-location-kathmandu-rooftop',
  'demo-location-pokhara-lakeside'
);

DELETE FROM events
WHERE id IN (
  'demo-event-kathmandu-midnight',
  'demo-event-pokhara-lakeside'
);

DELETE FROM organization_users
WHERE id IN (
  'demo-org-user-kathmandu-mira',
  'demo-org-user-pokhara-asha'
);

DELETE FROM user_web_roles
WHERE id IN (
  'demo-user-webrole-mira-org',
  'demo-user-webrole-asha-org',
  'demo-user-webrole-abc-partner',
  'demo-user-webrole-wavepass-partner',
  'demo-user-webrole-customer-sanjay',
  'demo-user-webrole-customer-neha',
  'demo-user-webrole-customer-prakash',
  'demo-user-webrole-customer-anjali'
);

DELETE FROM customers
WHERE id IN (
  'demo-customer-sanjay',
  'demo-customer-neha',
  'demo-customer-prakash',
  'demo-customer-anjali'
);

DELETE FROM organizations
WHERE id IN (
  'demo-org-kathmandu-live',
  'demo-org-pokhara-weekender'
);

DELETE FROM users
WHERE id IN (
  'demo-user-mira',
  'demo-user-asha',
  'demo-user-abc-partner',
  'demo-user-wavepass-partner',
  'demo-user-sanjay',
  'demo-user-neha',
  'demo-user-prakash',
  'demo-user-anjali'
);

INSERT OR IGNORE INTO web_roles (id, name, description, is_active, created_at, updated_at)
VALUES
  ('role-partner-user', 'PartnerUser', 'Partner-facing reporting access for commissions and referrals.', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

INSERT INTO users (
  id, first_name, last_name, email, phone_number, password_hash, is_active, is_email_verified, is_phone_verified,
  webrole, auth_provider, google_sub, avatar_url, last_login_at, created_at, updated_at
)
VALUES
  ('demo-user-mira', 'Mira', 'Shrestha', 'mira.shrestha@kathmandulive.com', '+9779801111001', NULL, 1, 1, 1, 'Organizations', 'password', NULL, NULL, '2026-05-01T10:00:00.000Z', '2026-02-01T09:00:00.000Z', '2026-05-01T10:00:00.000Z'),
  ('demo-user-asha', 'Asha', 'Gurung', 'asha.gurung@pokharaweekender.com', '+9779801111002', NULL, 1, 1, 1, 'Organizations', 'password', NULL, NULL, '2026-05-02T11:00:00.000Z', '2026-02-03T09:00:00.000Z', '2026-05-02T11:00:00.000Z'),
  ('demo-user-abc-partner', 'Anish', 'Bastola', 'anish@abcexperiences.com', '+9779801111003', NULL, 1, 1, 1, 'PartnerUser', 'password', NULL, NULL, '2026-05-03T12:00:00.000Z', '2026-02-05T09:00:00.000Z', '2026-05-03T12:00:00.000Z'),
  ('demo-user-wavepass-partner', 'Rojan', 'Tamang', 'rojan@wavepass.club', '+9779801111004', NULL, 1, 1, 1, 'PartnerUser', 'password', NULL, NULL, '2026-05-04T12:00:00.000Z', '2026-02-07T09:00:00.000Z', '2026-05-04T12:00:00.000Z'),
  ('demo-user-sanjay', 'Sanjay', 'Adhikari', 'sanjay.adhikari@example.com', '+9779805551001', NULL, 1, 1, 1, 'Customers', 'password', NULL, NULL, '2026-04-11T18:20:00.000Z', '2026-03-01T09:00:00.000Z', '2026-04-11T18:20:00.000Z'),
  ('demo-user-neha', 'Neha', 'Karki', 'neha.karki@example.com', '+9779805551002', NULL, 1, 1, 1, 'Customers', 'password', NULL, NULL, '2026-04-18T19:05:00.000Z', '2026-03-02T09:00:00.000Z', '2026-04-18T19:05:00.000Z'),
  ('demo-user-prakash', 'Prakash', 'Lama', 'prakash.lama@example.com', '+9779805551003', NULL, 1, 1, 1, 'Customers', 'password', NULL, NULL, '2026-05-04T17:45:00.000Z', '2026-03-03T09:00:00.000Z', '2026-05-04T17:45:00.000Z'),
  ('demo-user-anjali', 'Anjali', 'Poudel', 'anjali.poudel@example.com', '+9779805551004', NULL, 1, 1, 1, 'Customers', 'password', NULL, NULL, '2026-05-06T17:45:00.000Z', '2026-03-04T09:00:00.000Z', '2026-05-06T17:45:00.000Z');

INSERT INTO organizations (
  id, name, legal_name, contact_email, contact_phone, created_by, created_at, updated_at
)
VALUES
  ('demo-org-kathmandu-live', 'Kathmandu Live Collective', 'Kathmandu Live Collective Pvt. Ltd.', 'hello@kathmandulive.com', '+9779804442001', 'demo-user-mira', '2026-02-01T09:00:00.000Z', '2026-05-01T10:00:00.000Z'),
  ('demo-org-pokhara-weekender', 'Pokhara Weekender Co.', 'Pokhara Weekender Co. Pvt. Ltd.', 'hello@pokharaweekender.com', '+9779804442002', 'demo-user-asha', '2026-02-03T09:00:00.000Z', '2026-05-02T11:00:00.000Z');

INSERT INTO organization_users (id, organization_id, user_id, role, created_at)
VALUES
  ('demo-org-user-kathmandu-mira', 'demo-org-kathmandu-live', 'demo-user-mira', 'admin', '2026-02-01T09:05:00.000Z'),
  ('demo-org-user-pokhara-asha', 'demo-org-pokhara-weekender', 'demo-user-asha', 'admin', '2026-02-03T09:05:00.000Z');

INSERT INTO customers (
  id, user_id, display_name, email, phone_number, billing_address, notes, is_active, created_at, updated_at
)
VALUES
  ('demo-customer-sanjay', 'demo-user-sanjay', 'Sanjay Adhikari', 'sanjay.adhikari@example.com', '+9779805551001', 'Baneshwor, Kathmandu', 'Buys for friend groups.', 1, '2026-03-01T09:00:00.000Z', '2026-04-11T18:20:00.000Z'),
  ('demo-customer-neha', 'demo-user-neha', 'Neha Karki', 'neha.karki@example.com', '+9779805551002', 'Lalitpur, Nepal', 'Often uses early bird coupons.', 1, '2026-03-02T09:00:00.000Z', '2026-04-18T19:05:00.000Z'),
  ('demo-customer-prakash', 'demo-user-prakash', 'Prakash Lama', 'prakash.lama@example.com', '+9779805551003', 'Lakeside, Pokhara', 'Weekend festival buyer.', 1, '2026-03-03T09:00:00.000Z', '2026-05-04T17:45:00.000Z'),
  ('demo-customer-anjali', 'demo-user-anjali', 'Anjali Poudel', 'anjali.poudel@example.com', '+9779805551004', 'Pokhara, Nepal', 'Refunded after schedule clash.', 1, '2026-03-04T09:00:00.000Z', '2026-05-06T17:45:00.000Z');

INSERT INTO user_web_roles (id, user_id, web_role_id, created_at)
VALUES
  ('demo-user-webrole-mira-org', 'demo-user-mira', 'role-organizations', '2026-02-01T09:10:00.000Z'),
  ('demo-user-webrole-asha-org', 'demo-user-asha', 'role-organizations', '2026-02-03T09:10:00.000Z'),
  ('demo-user-webrole-abc-partner', 'demo-user-abc-partner', 'role-partner-user', '2026-02-05T09:10:00.000Z'),
  ('demo-user-webrole-wavepass-partner', 'demo-user-wavepass-partner', 'role-partner-user', '2026-02-07T09:10:00.000Z'),
  ('demo-user-webrole-customer-sanjay', 'demo-user-sanjay', 'role-customers', '2026-03-01T09:10:00.000Z'),
  ('demo-user-webrole-customer-neha', 'demo-user-neha', 'role-customers', '2026-03-02T09:10:00.000Z'),
  ('demo-user-webrole-customer-prakash', 'demo-user-prakash', 'role-customers', '2026-03-03T09:10:00.000Z'),
  ('demo-user-webrole-customer-anjali', 'demo-user-anjali', 'role-customers', '2026-03-04T09:10:00.000Z');

INSERT INTO events (
  id, organization_id, name, slug, description, event_type, start_datetime, end_datetime, status, banner_file_id, created_by, created_at, updated_at
)
VALUES
  (
    'demo-event-kathmandu-midnight',
    'demo-org-kathmandu-live',
    'Midnight Rooftop Sessions: Kathmandu',
    'midnight-rooftop-sessions-kathmandu',
    'A late-night rooftop concert with live electronic sets, skyline views, and a curated food deck in Kathmandu.',
    'concert',
    '2026-05-14T18:30:00.000Z',
    '2026-05-14T23:30:00.000Z',
    'published',
    NULL,
    'demo-user-mira',
    '2026-02-10T09:00:00.000Z',
    '2026-05-01T10:15:00.000Z'
  ),
  (
    'demo-event-pokhara-lakeside',
    'demo-org-pokhara-weekender',
    'Pokhara Lakeside Indie Fest',
    'pokhara-lakeside-indie-fest',
    'A two-day indie music and arts gathering with sunset sets by the lake, pop-up merch, and local food stalls.',
    'festival',
    '2026-05-28T10:00:00.000Z',
    '2026-05-29T21:00:00.000Z',
    'published',
    NULL,
    'demo-user-asha',
    '2026-02-12T09:00:00.000Z',
    '2026-05-02T11:15:00.000Z'
  );

INSERT INTO event_locations (
  id, event_id, name, address, latitude, longitude, total_capacity, is_active, created_by, created_at, updated_at
)
VALUES
  ('demo-location-kathmandu-rooftop', 'demo-event-kathmandu-midnight', 'Skyline Terrace, Thamel', 'Thamel Marg, Kathmandu', 27.7172, 85.3240, 350, 1, 'demo-user-mira', '2026-02-10T09:15:00.000Z', '2026-05-01T10:15:00.000Z'),
  ('demo-location-pokhara-lakeside', 'demo-event-pokhara-lakeside', 'Lakeside Lawn, Pokhara', 'Lakeside Road, Pokhara', 28.2096, 83.9856, 900, 1, 'demo-user-asha', '2026-02-12T09:15:00.000Z', '2026-05-02T11:15:00.000Z');

INSERT INTO ticket_types (
  id, event_id, event_location_id, name, description, price_paisa, currency, quantity_available, quantity_sold, sale_start_datetime, sale_end_datetime, min_per_order, max_per_order, is_active, created_at, updated_at
)
VALUES
  ('demo-ticket-kathmandu-vip', 'demo-event-kathmandu-midnight', 'demo-location-kathmandu-rooftop', 'VIP Terrace Pass', 'Front terrace access with welcome drink and artist meet area.', 100000, 'NPR', 120, 2, '2026-03-01T00:00:00.000Z', '2026-05-14T17:30:00.000Z', 1, 4, 1, '2026-02-10T09:30:00.000Z', '2026-05-01T10:15:00.000Z'),
  ('demo-ticket-kathmandu-ga', 'demo-event-kathmandu-midnight', 'demo-location-kathmandu-rooftop', 'General Access', 'Standard standing access for the rooftop show.', 50000, 'NPR', 230, 3, '2026-03-01T00:00:00.000Z', '2026-05-14T17:30:00.000Z', 1, 6, 1, '2026-02-10T09:35:00.000Z', '2026-05-01T10:15:00.000Z'),
  ('demo-ticket-pokhara-weekender', 'demo-event-pokhara-lakeside', 'demo-location-pokhara-lakeside', 'Weekend Pass', 'Two-day access with lakeside stage entry.', 85000, 'NPR', 400, 2, '2026-03-10T00:00:00.000Z', '2026-05-28T09:00:00.000Z', 1, 4, 1, '2026-02-12T09:30:00.000Z', '2026-05-02T11:15:00.000Z'),
  ('demo-ticket-pokhara-sunset', 'demo-event-pokhara-lakeside', 'demo-location-pokhara-lakeside', 'Sunset Day Pass', 'Single-day access for the sunset headline block.', 30000, 'NPR', 500, 4, '2026-03-10T00:00:00.000Z', '2026-05-28T09:00:00.000Z', 1, 6, 1, '2026-02-12T09:35:00.000Z', '2026-05-02T11:15:00.000Z');

INSERT INTO coupons (
  id, event_id, code, description, discount_type, discount_amount_paisa, discount_percentage, max_redemptions, redeemed_count, min_order_amount_paisa, start_datetime, end_datetime, is_active, created_at, updated_at
)
VALUES
  (
    'demo-coupon-rooftop-earlybird',
    'demo-event-kathmandu-midnight',
    'ROOFTOPEARLY',
    'Early bird rooftop discount for first wave buyers.',
    'flat',
    10000,
    NULL,
    50,
    1,
    100000,
    '2026-03-15T00:00:00.000Z',
    '2026-04-30T23:59:59.000Z',
    1,
    '2026-03-10T09:00:00.000Z',
    '2026-04-18T19:05:00.000Z'
  );

INSERT INTO partners (
  id, organization_id, name, code, partner_type, parent_partner_id, is_active, created_by, created_at, updated_at
)
VALUES
  ('demo-partner-abc', NULL, 'ABC Experiences', 'ABC-EXP', 'main_partner', NULL, 1, 'demo-user-mira', '2026-02-15T09:00:00.000Z', '2026-05-01T10:30:00.000Z'),
  ('demo-partner-rita', NULL, 'Rita Rai', 'RITA-RAI', 'influencer', 'demo-partner-abc', 1, 'demo-user-mira', '2026-02-16T09:00:00.000Z', '2026-05-01T10:30:00.000Z'),
  ('demo-partner-wavepass', NULL, 'WavePass Club', 'WAVEPASS', 'affiliate', NULL, 1, 'demo-user-asha', '2026-02-18T09:00:00.000Z', '2026-05-02T11:30:00.000Z'),
  ('demo-partner-nima', NULL, 'Nima Tamang', 'NIMA-T', 'influencer', 'demo-partner-wavepass', 1, 'demo-user-asha', '2026-02-19T09:00:00.000Z', '2026-05-02T11:30:00.000Z');

INSERT INTO partner_users (id, partner_id, user_id, role, created_at, updated_at)
VALUES
  ('demo-partner-user-abc', 'demo-partner-abc', 'demo-user-abc-partner', 'owner', '2026-02-15T09:15:00.000Z', '2026-05-03T12:00:00.000Z'),
  ('demo-partner-user-wavepass', 'demo-partner-wavepass', 'demo-user-wavepass-partner', 'owner', '2026-02-18T09:15:00.000Z', '2026-05-04T12:00:00.000Z');

INSERT INTO referral_codes (
  id, code, partner_id, event_id, description, is_active, created_by, created_at, updated_at
)
VALUES
  ('demo-referral-rita-kathmandu', 'RITAAFTERGLOW', 'demo-partner-rita', 'demo-event-kathmandu-midnight', 'Rita Rai creator code for rooftop sessions.', 1, 'demo-user-mira', '2026-03-05T10:00:00.000Z', '2026-05-01T10:40:00.000Z'),
  ('demo-referral-nima-pokhara', 'NIMAWAVE', 'demo-partner-nima', 'demo-event-pokhara-lakeside', 'Nima Tamang creator code for Lakeside Indie Fest.', 1, 'demo-user-asha', '2026-03-06T10:00:00.000Z', '2026-05-02T11:40:00.000Z');

INSERT INTO commission_rules (
  id, name, event_id, partner_id, referral_code_id, applies_to, commission_type, stacking_group, stacking_behavior,
  priority, commission_source, rate_value, flat_amount_paisa, max_commission_amount_paisa, max_total_commission_percent_bps,
  tier_config_json, is_active, start_datetime, end_datetime, created_by, created_at, updated_at
)
VALUES
  ('demo-rule-kathmandu-platform-fee', 'Kathmandu platform fee 8%', 'demo-event-kathmandu-midnight', NULL, NULL, 'platform', 'platform_fee_percent', 'platform', 'stackable', 100, 'organizer_share', 800, NULL, NULL, NULL, NULL, 1, '2026-03-01T00:00:00.000Z', '2026-05-14T23:59:59.000Z', 'demo-user-mira', '2026-03-01T10:00:00.000Z', '2026-05-01T10:45:00.000Z'),
  ('demo-rule-kathmandu-abc-main', 'ABC event partner 10%', 'demo-event-kathmandu-midnight', 'demo-partner-abc', NULL, 'event', 'percent_of_sales', 'event_partner', 'stackable', 90, 'organizer_share', 1000, NULL, NULL, 2500, NULL, 1, '2026-03-01T00:00:00.000Z', '2026-05-14T23:59:59.000Z', 'demo-user-mira', '2026-03-01T10:05:00.000Z', '2026-05-01T10:45:00.000Z'),
  ('demo-rule-kathmandu-rita-referral', 'Rita referral 5%', 'demo-event-kathmandu-midnight', 'demo-partner-rita', 'demo-referral-rita-kathmandu', 'referral_code', 'percent_of_sales', 'referral', 'exclusive', 120, 'organizer_share', 500, NULL, NULL, 2500, NULL, 1, '2026-03-05T00:00:00.000Z', '2026-05-14T23:59:59.000Z', 'demo-user-mira', '2026-03-05T10:05:00.000Z', '2026-05-01T10:45:00.000Z'),
  ('demo-rule-kathmandu-abc-override', 'ABC parent override 2%', 'demo-event-kathmandu-midnight', 'demo-partner-abc', NULL, 'partner', 'override_percent', 'parent_override', 'stackable', 110, 'organizer_share', 200, NULL, NULL, NULL, NULL, 1, '2026-03-01T00:00:00.000Z', '2026-05-14T23:59:59.000Z', 'demo-user-mira', '2026-03-01T10:10:00.000Z', '2026-05-01T10:45:00.000Z'),
  ('demo-rule-pokhara-platform-fee', 'Pokhara platform fee 8%', 'demo-event-pokhara-lakeside', NULL, NULL, 'platform', 'platform_fee_percent', 'platform', 'stackable', 100, 'organizer_share', 800, NULL, NULL, NULL, NULL, 1, '2026-03-10T00:00:00.000Z', '2026-05-29T23:59:59.000Z', 'demo-user-asha', '2026-03-10T10:00:00.000Z', '2026-05-02T11:45:00.000Z'),
  ('demo-rule-pokhara-wavepass-main', 'WavePass event partner 8%', 'demo-event-pokhara-lakeside', 'demo-partner-wavepass', NULL, 'event', 'percent_of_sales', 'event_partner', 'stackable', 90, 'organizer_share', 800, NULL, NULL, 2500, NULL, 1, '2026-03-10T00:00:00.000Z', '2026-05-29T23:59:59.000Z', 'demo-user-asha', '2026-03-10T10:05:00.000Z', '2026-05-02T11:45:00.000Z'),
  ('demo-rule-pokhara-nima-referral', 'Nima referral 4%', 'demo-event-pokhara-lakeside', 'demo-partner-nima', 'demo-referral-nima-pokhara', 'referral_code', 'percent_of_sales', 'referral', 'exclusive', 120, 'organizer_share', 400, NULL, NULL, 2500, NULL, 1, '2026-03-10T00:00:00.000Z', '2026-05-29T23:59:59.000Z', 'demo-user-asha', '2026-03-10T10:10:00.000Z', '2026-05-02T11:45:00.000Z'),
  ('demo-rule-pokhara-wavepass-override', 'WavePass parent override 1.5%', 'demo-event-pokhara-lakeside', 'demo-partner-wavepass', NULL, 'partner', 'override_percent', 'parent_override', 'stackable', 110, 'organizer_share', 150, NULL, NULL, NULL, NULL, 1, '2026-03-10T00:00:00.000Z', '2026-05-29T23:59:59.000Z', 'demo-user-asha', '2026-03-10T10:15:00.000Z', '2026-05-02T11:45:00.000Z');

INSERT INTO orders (
  id, order_number, customer_id, event_id, event_location_id, status, subtotal_amount_paisa, discount_amount_paisa,
  tax_amount_paisa, total_amount_paisa, currency, order_datetime, expires_at, created_at, updated_at
)
VALUES
  ('demo-order-1', 'WT-2026-0401', 'demo-user-sanjay', 'demo-event-kathmandu-midnight', 'demo-location-kathmandu-rooftop', 'paid', 200000, 0, 0, 200000, 'NPR', '2026-04-11T18:10:00.000Z', NULL, '2026-04-11T18:10:00.000Z', '2026-04-11T18:20:00.000Z'),
  ('demo-order-2', 'WT-2026-0402', 'demo-user-neha', 'demo-event-kathmandu-midnight', 'demo-location-kathmandu-rooftop', 'paid', 150000, 10000, 0, 140000, 'NPR', '2026-04-18T18:55:00.000Z', NULL, '2026-04-18T18:55:00.000Z', '2026-04-18T19:05:00.000Z'),
  ('demo-order-3', 'WT-2026-0501', 'demo-user-prakash', 'demo-event-pokhara-lakeside', 'demo-location-pokhara-lakeside', 'paid', 170000, 0, 0, 170000, 'NPR', '2026-05-04T17:30:00.000Z', NULL, '2026-05-04T17:30:00.000Z', '2026-05-04T17:45:00.000Z'),
  ('demo-order-4', 'WT-2026-0502', 'demo-user-anjali', 'demo-event-pokhara-lakeside', 'demo-location-pokhara-lakeside', 'refunded', 120000, 0, 0, 120000, 'NPR', '2026-05-06T17:30:00.000Z', NULL, '2026-05-06T17:30:00.000Z', '2026-05-08T09:30:00.000Z');

INSERT INTO order_items (
  id, order_id, ticket_type_id, quantity, unit_price_paisa, subtotal_amount_paisa, discount_amount_paisa, total_amount_paisa, description, created_at
)
VALUES
  ('demo-order-item-1-vip', 'demo-order-1', 'demo-ticket-kathmandu-vip', 2, 100000, 200000, 0, 200000, 'VIP terrace pair for rooftop headline set.', '2026-04-11T18:10:00.000Z'),
  ('demo-order-item-2-ga', 'demo-order-2', 'demo-ticket-kathmandu-ga', 3, 50000, 150000, 10000, 140000, 'General access group booking with early bird coupon.', '2026-04-18T18:55:00.000Z'),
  ('demo-order-item-3-weekender', 'demo-order-3', 'demo-ticket-pokhara-weekender', 2, 85000, 170000, 0, 170000, 'Two weekend passes bought through influencer code.', '2026-05-04T17:30:00.000Z'),
  ('demo-order-item-4-sunset', 'demo-order-4', 'demo-ticket-pokhara-sunset', 4, 30000, 120000, 0, 120000, 'Four sunset day passes later fully refunded.', '2026-05-06T17:30:00.000Z');

INSERT INTO coupon_redemptions (id, coupon_id, order_id, customer_id, discount_amount_paisa, redeemed_at)
VALUES
  ('demo-coupon-redemption-order2', 'demo-coupon-rooftop-earlybird', 'demo-order-2', 'demo-user-neha', 10000, '2026-04-18T18:56:00.000Z');

INSERT INTO payments (
  id, order_id, customer_id, payment_provider, khalti_pidx, khalti_transaction_id, khalti_purchase_order_id,
  amount_paisa, currency, status, payment_datetime, verified_datetime, raw_request, raw_response, created_at, updated_at
)
VALUES
  ('demo-payment-order1', 'demo-order-1', 'demo-user-sanjay', 'khalti', 'demo-pidx-0401', 'txn-0401', 'purchase-0401', 200000, 'NPR', 'paid', '2026-04-11T18:15:00.000Z', '2026-04-11T18:20:00.000Z', '{"scenario":"vip_rooftop"}', '{"status":"Completed"}', '2026-04-11T18:10:00.000Z', '2026-04-11T18:20:00.000Z'),
  ('demo-payment-order2', 'demo-order-2', 'demo-user-neha', 'khalti', 'demo-pidx-0402', 'txn-0402', 'purchase-0402', 140000, 'NPR', 'paid', '2026-04-18T19:00:00.000Z', '2026-04-18T19:05:00.000Z', '{"scenario":"coupon_group"}', '{"status":"Completed"}', '2026-04-18T18:55:00.000Z', '2026-04-18T19:05:00.000Z'),
  ('demo-payment-order3', 'demo-order-3', 'demo-user-prakash', 'khalti', 'demo-pidx-0501', 'txn-0501', 'purchase-0501', 170000, 'NPR', 'paid', '2026-05-04T17:40:00.000Z', '2026-05-04T17:45:00.000Z', '{"scenario":"festival_referral"}', '{"status":"Completed"}', '2026-05-04T17:30:00.000Z', '2026-05-04T17:45:00.000Z'),
  ('demo-payment-order4', 'demo-order-4', 'demo-user-anjali', 'khalti', 'demo-pidx-0502', 'txn-0502', 'purchase-0502', 120000, 'NPR', 'paid', '2026-05-06T17:40:00.000Z', '2026-05-06T17:45:00.000Z', '{"scenario":"festival_refunded"}', '{"status":"Completed"}', '2026-05-06T17:30:00.000Z', '2026-05-06T17:45:00.000Z');

INSERT INTO refunds (
  id, order_id, payment_id, refund_reference, status, reason, refund_amount_paisa, created_by, created_at, updated_at
)
VALUES
  ('demo-refund-order4-full', 'demo-order-4', 'demo-payment-order4', 'refund-0502-full', 'processed', 'Customer could not attend due to travel delay.', 120000, 'demo-user-asha', '2026-05-08T09:30:00.000Z', '2026-05-08T09:35:00.000Z');

INSERT INTO commission_ledger (
  id, order_id, event_id, beneficiary_type, beneficiary_id, partner_id, referral_code_id, commission_rule_id,
  commission_type, base_amount_paisa, commission_rate_bps, commission_amount_paisa, commission_source,
  stacking_group, status, entry_type, reverses_ledger_id, refund_id, notes, created_at, updated_at
)
VALUES
  ('demo-ledger-order1-abc-main', 'demo-order-1', 'demo-event-kathmandu-midnight', 'partner', 'demo-partner-abc', 'demo-partner-abc', NULL, 'demo-rule-kathmandu-abc-main', 'percent_of_sales', 200000, 1000, 20000, 'organizer_share', 'event_partner', 'approved', 'original', NULL, NULL, 'ABC event-level commission on VIP rooftop order.', '2026-04-11T18:21:00.000Z', '2026-04-11T18:21:00.000Z'),
  ('demo-ledger-order1-rita-referral', 'demo-order-1', 'demo-event-kathmandu-midnight', 'partner', 'demo-partner-rita', 'demo-partner-rita', 'demo-referral-rita-kathmandu', 'demo-rule-kathmandu-rita-referral', 'percent_of_sales', 200000, 500, 10000, 'organizer_share', 'referral', 'approved', 'original', NULL, NULL, 'Rita referral commission from creator code usage.', '2026-04-11T18:21:00.000Z', '2026-04-11T18:21:00.000Z'),
  ('demo-ledger-order1-abc-override', 'demo-order-1', 'demo-event-kathmandu-midnight', 'partner', 'demo-partner-abc', 'demo-partner-abc', 'demo-referral-rita-kathmandu', 'demo-rule-kathmandu-abc-override', 'override_percent', 200000, 200, 4000, 'organizer_share', 'parent_override', 'approved', 'original', NULL, NULL, 'Parent override for Rita under ABC Experiences.', '2026-04-11T18:21:00.000Z', '2026-04-11T18:21:00.000Z'),
  ('demo-ledger-order1-platform-fee', 'demo-order-1', 'demo-event-kathmandu-midnight', 'platform', 'waah-platform', NULL, NULL, 'demo-rule-kathmandu-platform-fee', 'platform_fee_percent', 200000, 800, 16000, 'organizer_share', 'platform', 'approved', 'original', NULL, NULL, 'Waah platform fee.', '2026-04-11T18:21:00.000Z', '2026-04-11T18:21:00.000Z'),
  ('demo-ledger-order1-gateway-fee', 'demo-order-1', 'demo-event-kathmandu-midnight', 'payment_gateway', 'khalti', NULL, NULL, NULL, 'gateway_fee', 200000, 250, 5000, 'organizer_share', 'gateway', 'approved', 'original', NULL, NULL, 'Gateway fee modeled in the ledger for reporting.', '2026-04-11T18:21:00.000Z', '2026-04-11T18:21:00.000Z'),

  ('demo-ledger-order2-abc-main', 'demo-order-2', 'demo-event-kathmandu-midnight', 'partner', 'demo-partner-abc', 'demo-partner-abc', NULL, 'demo-rule-kathmandu-abc-main', 'percent_of_sales', 140000, 1000, 14000, 'organizer_share', 'event_partner', 'approved', 'original', NULL, NULL, 'ABC event-level commission on discounted GA group order.', '2026-04-18T19:06:00.000Z', '2026-04-18T19:06:00.000Z'),
  ('demo-ledger-order2-platform-fee', 'demo-order-2', 'demo-event-kathmandu-midnight', 'platform', 'waah-platform', NULL, NULL, 'demo-rule-kathmandu-platform-fee', 'platform_fee_percent', 140000, 800, 11200, 'organizer_share', 'platform', 'approved', 'original', NULL, NULL, 'Waah platform fee on discounted order.', '2026-04-18T19:06:00.000Z', '2026-04-18T19:06:00.000Z'),
  ('demo-ledger-order2-gateway-fee', 'demo-order-2', 'demo-event-kathmandu-midnight', 'payment_gateway', 'khalti', NULL, NULL, NULL, 'gateway_fee', 140000, 250, 3500, 'organizer_share', 'gateway', 'approved', 'original', NULL, NULL, 'Gateway fee modeled in the ledger for reporting.', '2026-04-18T19:06:00.000Z', '2026-04-18T19:06:00.000Z'),

  ('demo-ledger-order3-wavepass-main', 'demo-order-3', 'demo-event-pokhara-lakeside', 'partner', 'demo-partner-wavepass', 'demo-partner-wavepass', NULL, 'demo-rule-pokhara-wavepass-main', 'percent_of_sales', 170000, 800, 13600, 'organizer_share', 'event_partner', 'approved', 'original', NULL, NULL, 'WavePass event-level commission on weekend pass order.', '2026-05-04T17:46:00.000Z', '2026-05-04T17:46:00.000Z'),
  ('demo-ledger-order3-nima-referral', 'demo-order-3', 'demo-event-pokhara-lakeside', 'partner', 'demo-partner-nima', 'demo-partner-nima', 'demo-referral-nima-pokhara', 'demo-rule-pokhara-nima-referral', 'percent_of_sales', 170000, 400, 6800, 'organizer_share', 'referral', 'approved', 'original', NULL, NULL, 'Nima influencer referral commission.', '2026-05-04T17:46:00.000Z', '2026-05-04T17:46:00.000Z'),
  ('demo-ledger-order3-wavepass-override', 'demo-order-3', 'demo-event-pokhara-lakeside', 'partner', 'demo-partner-wavepass', 'demo-partner-wavepass', 'demo-referral-nima-pokhara', 'demo-rule-pokhara-wavepass-override', 'override_percent', 170000, 150, 2550, 'organizer_share', 'parent_override', 'approved', 'original', NULL, NULL, 'Parent override for Nima under WavePass Club.', '2026-05-04T17:46:00.000Z', '2026-05-04T17:46:00.000Z'),
  ('demo-ledger-order3-platform-fee', 'demo-order-3', 'demo-event-pokhara-lakeside', 'platform', 'waah-platform', NULL, NULL, 'demo-rule-pokhara-platform-fee', 'platform_fee_percent', 170000, 800, 13600, 'organizer_share', 'platform', 'approved', 'original', NULL, NULL, 'Waah platform fee on Pokhara festival order.', '2026-05-04T17:46:00.000Z', '2026-05-04T17:46:00.000Z'),
  ('demo-ledger-order3-gateway-fee', 'demo-order-3', 'demo-event-pokhara-lakeside', 'payment_gateway', 'khalti', NULL, NULL, NULL, 'gateway_fee', 170000, 250, 4250, 'organizer_share', 'gateway', 'approved', 'original', NULL, NULL, 'Gateway fee modeled in the ledger for reporting.', '2026-05-04T17:46:00.000Z', '2026-05-04T17:46:00.000Z'),

  ('demo-ledger-order4-wavepass-main', 'demo-order-4', 'demo-event-pokhara-lakeside', 'partner', 'demo-partner-wavepass', 'demo-partner-wavepass', NULL, 'demo-rule-pokhara-wavepass-main', 'percent_of_sales', 120000, 800, 9600, 'organizer_share', 'event_partner', 'approved', 'original', NULL, NULL, 'WavePass event-level commission on refunded order.', '2026-05-06T17:46:00.000Z', '2026-05-06T17:46:00.000Z'),
  ('demo-ledger-order4-nima-referral', 'demo-order-4', 'demo-event-pokhara-lakeside', 'partner', 'demo-partner-nima', 'demo-partner-nima', 'demo-referral-nima-pokhara', 'demo-rule-pokhara-nima-referral', 'percent_of_sales', 120000, 400, 4800, 'organizer_share', 'referral', 'approved', 'original', NULL, NULL, 'Nima referral commission on refunded order.', '2026-05-06T17:46:00.000Z', '2026-05-06T17:46:00.000Z'),
  ('demo-ledger-order4-wavepass-override', 'demo-order-4', 'demo-event-pokhara-lakeside', 'partner', 'demo-partner-wavepass', 'demo-partner-wavepass', 'demo-referral-nima-pokhara', 'demo-rule-pokhara-wavepass-override', 'override_percent', 120000, 150, 1800, 'organizer_share', 'parent_override', 'approved', 'original', NULL, NULL, 'Parent override on refunded order.', '2026-05-06T17:46:00.000Z', '2026-05-06T17:46:00.000Z'),
  ('demo-ledger-order4-platform-fee', 'demo-order-4', 'demo-event-pokhara-lakeside', 'platform', 'waah-platform', NULL, NULL, 'demo-rule-pokhara-platform-fee', 'platform_fee_percent', 120000, 800, 9600, 'organizer_share', 'platform', 'approved', 'original', NULL, NULL, 'Waah platform fee on refunded order.', '2026-05-06T17:46:00.000Z', '2026-05-06T17:46:00.000Z'),
  ('demo-ledger-order4-gateway-fee', 'demo-order-4', 'demo-event-pokhara-lakeside', 'payment_gateway', 'khalti', NULL, NULL, NULL, 'gateway_fee', 120000, 250, 3000, 'organizer_share', 'gateway', 'approved', 'original', NULL, NULL, 'Gateway fee on refunded order.', '2026-05-06T17:46:00.000Z', '2026-05-06T17:46:00.000Z'),

  ('demo-ledger-order4-wavepass-main-reversal', 'demo-order-4', 'demo-event-pokhara-lakeside', 'partner', 'demo-partner-wavepass', 'demo-partner-wavepass', NULL, 'demo-rule-pokhara-wavepass-main', 'percent_of_sales', 120000, 800, -9600, 'organizer_share', 'event_partner', 'reversed', 'reversal', 'demo-ledger-order4-wavepass-main', 'demo-refund-order4-full', 'Full refund reversal for WavePass commission.', '2026-05-08T09:36:00.000Z', '2026-05-08T09:36:00.000Z'),
  ('demo-ledger-order4-nima-referral-reversal', 'demo-order-4', 'demo-event-pokhara-lakeside', 'partner', 'demo-partner-nima', 'demo-partner-nima', 'demo-referral-nima-pokhara', 'demo-rule-pokhara-nima-referral', 'percent_of_sales', 120000, 400, -4800, 'organizer_share', 'referral', 'reversed', 'reversal', 'demo-ledger-order4-nima-referral', 'demo-refund-order4-full', 'Full refund reversal for Nima referral commission.', '2026-05-08T09:36:00.000Z', '2026-05-08T09:36:00.000Z'),
  ('demo-ledger-order4-wavepass-override-reversal', 'demo-order-4', 'demo-event-pokhara-lakeside', 'partner', 'demo-partner-wavepass', 'demo-partner-wavepass', 'demo-referral-nima-pokhara', 'demo-rule-pokhara-wavepass-override', 'override_percent', 120000, 150, -1800, 'organizer_share', 'parent_override', 'reversed', 'reversal', 'demo-ledger-order4-wavepass-override', 'demo-refund-order4-full', 'Full refund reversal for parent override.', '2026-05-08T09:36:00.000Z', '2026-05-08T09:36:00.000Z'),
  ('demo-ledger-order4-platform-fee-reversal', 'demo-order-4', 'demo-event-pokhara-lakeside', 'platform', 'waah-platform', NULL, NULL, 'demo-rule-pokhara-platform-fee', 'platform_fee_percent', 120000, 800, -9600, 'organizer_share', 'platform', 'reversed', 'reversal', 'demo-ledger-order4-platform-fee', 'demo-refund-order4-full', 'Full refund reversal for platform fee.', '2026-05-08T09:36:00.000Z', '2026-05-08T09:36:00.000Z'),
  ('demo-ledger-order4-gateway-fee-reversal', 'demo-order-4', 'demo-event-pokhara-lakeside', 'payment_gateway', 'khalti', NULL, NULL, NULL, 'gateway_fee', 120000, 250, -3000, 'organizer_share', 'gateway', 'reversed', 'reversal', 'demo-ledger-order4-gateway-fee', 'demo-refund-order4-full', 'Full refund reversal for gateway fee.', '2026-05-08T09:36:00.000Z', '2026-05-08T09:36:00.000Z');

INSERT INTO partner_reporting_permissions (
  id, grantee_partner_id, subject_partner_id, permission_type, expires_at, created_by, created_at
)
VALUES
  ('demo-permission-abc-view-rita', 'demo-partner-abc', 'demo-partner-rita', 'view_child_rollup', NULL, 'demo-user-mira', '2026-03-15T10:00:00.000Z');

INSERT INTO payout_batches (
  id, batch_type, organization_id, partner_id, status, currency, total_amount_paisa, paid_at, created_by, created_at, updated_at
)
VALUES
  ('demo-payout-batch-organizer-kathmandu', 'organizer_settlement', 'demo-org-kathmandu-live', NULL, 'pending', 'NPR', 256300, NULL, 'demo-user-mira', '2026-05-15T09:00:00.000Z', '2026-05-15T09:00:00.000Z'),
  ('demo-payout-batch-organizer-pokhara', 'organizer_settlement', 'demo-org-pokhara-weekender', NULL, 'paid', 'NPR', 129200, '2026-05-30T16:00:00.000Z', 'demo-user-asha', '2026-05-30T12:00:00.000Z', '2026-05-30T16:00:00.000Z'),
  ('demo-payout-batch-partner-abc', 'partner_commission', NULL, 'demo-partner-abc', 'pending', 'NPR', 38000, NULL, 'demo-user-mira', '2026-05-16T09:00:00.000Z', '2026-05-16T09:00:00.000Z'),
  ('demo-payout-batch-partner-rita', 'partner_commission', NULL, 'demo-partner-rita', 'paid', 'NPR', 10000, '2026-05-16T13:00:00.000Z', 'demo-user-mira', '2026-05-16T10:00:00.000Z', '2026-05-16T13:00:00.000Z'),
  ('demo-payout-batch-partner-wavepass', 'partner_commission', NULL, 'demo-partner-wavepass', 'pending', 'NPR', 15950, NULL, 'demo-user-asha', '2026-05-30T09:00:00.000Z', '2026-05-30T09:00:00.000Z'),
  ('demo-payout-batch-partner-nima', 'partner_commission', NULL, 'demo-partner-nima', 'paid', 'NPR', 6800, '2026-05-30T14:00:00.000Z', 'demo-user-asha', '2026-05-30T10:00:00.000Z', '2026-05-30T14:00:00.000Z');

INSERT INTO payout_items (
  id, payout_batch_id, beneficiary_type, beneficiary_id, order_id, event_id, commission_ledger_id, amount_paisa, status, paid_at, created_at, updated_at
)
VALUES
  ('demo-payout-item-organizer-kathmandu', 'demo-payout-batch-organizer-kathmandu', 'organization', 'demo-org-kathmandu-live', NULL, 'demo-event-kathmandu-midnight', NULL, 256300, 'pending', NULL, '2026-05-15T09:10:00.000Z', '2026-05-15T09:10:00.000Z'),
  ('demo-payout-item-organizer-pokhara', 'demo-payout-batch-organizer-pokhara', 'organization', 'demo-org-pokhara-weekender', NULL, 'demo-event-pokhara-lakeside', NULL, 129200, 'paid', '2026-05-30T16:00:00.000Z', '2026-05-30T12:10:00.000Z', '2026-05-30T16:00:00.000Z'),
  ('demo-payout-item-abc-event1', 'demo-payout-batch-partner-abc', 'partner', 'demo-partner-abc', 'demo-order-1', 'demo-event-kathmandu-midnight', 'demo-ledger-order1-abc-main', 20000, 'pending', NULL, '2026-05-16T09:10:00.000Z', '2026-05-16T09:10:00.000Z'),
  ('demo-payout-item-abc-override-event1', 'demo-payout-batch-partner-abc', 'partner', 'demo-partner-abc', 'demo-order-1', 'demo-event-kathmandu-midnight', 'demo-ledger-order1-abc-override', 4000, 'pending', NULL, '2026-05-16T09:10:00.000Z', '2026-05-16T09:10:00.000Z'),
  ('demo-payout-item-rita-event1', 'demo-payout-batch-partner-rita', 'partner', 'demo-partner-rita', 'demo-order-1', 'demo-event-kathmandu-midnight', 'demo-ledger-order1-rita-referral', 10000, 'paid', '2026-05-16T13:00:00.000Z', '2026-05-16T10:10:00.000Z', '2026-05-16T13:00:00.000Z'),
  ('demo-payout-item-wavepass-event2', 'demo-payout-batch-partner-wavepass', 'partner', 'demo-partner-wavepass', 'demo-order-3', 'demo-event-pokhara-lakeside', 'demo-ledger-order3-wavepass-main', 15950, 'pending', NULL, '2026-05-30T09:10:00.000Z', '2026-05-30T09:10:00.000Z'),
  ('demo-payout-item-nima-event2', 'demo-payout-batch-partner-nima', 'partner', 'demo-partner-nima', 'demo-order-3', 'demo-event-pokhara-lakeside', 'demo-ledger-order3-nima-referral', 6800, 'paid', '2026-05-30T14:00:00.000Z', '2026-05-30T10:10:00.000Z', '2026-05-30T14:00:00.000Z');

INSERT INTO report_exports (
  id, report_type, requested_by_user_id, role, filters_json, status, storage_key, file_url, generated_at, error_message, created_at, updated_at
)
VALUES
  (
    'demo-report-export-admin-summary',
    'admin-summary',
    'demo-user-mira',
    'Admin',
    '{"start":"2026-04-01T00:00:00.000Z","end":"2026-05-31T23:59:59.999Z"}',
    'generated',
    'reports/demo/admin-summary-2026-05.pdf',
    'https://files.waahtickets.example/reports/demo/admin-summary-2026-05.pdf',
    '2026-05-31T18:00:00.000Z',
    NULL,
    '2026-05-31T17:30:00.000Z',
    '2026-05-31T18:00:00.000Z'
  );
