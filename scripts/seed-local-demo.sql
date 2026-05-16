-- Local demo catalog seed for browser testing.
-- Includes organizations, published future events, locations, ticket types, and coupon-system test coupons.
--
-- Coupon codes to test:
--   ORG-SUMMIT-20      20% off eligible Summit Sound events only
--   WAAH-500           NPR 500 off any event
--   WAAH-JAZZ-15       15% off Kathmandu Jazz Rooftop only
--   ORG-FOOD-1000      NPR 1000 off the Newari Feast Night event only
--
-- QR payloads are the public code prefixed with waahcoupon:v1:
--   waahcoupon:v1:ORG-SUMMIT-20

PRAGMA foreign_keys = ON;

INSERT INTO organizations (
  id,
  name,
  legal_name,
  contact_email,
  contact_phone,
  created_by,
  created_at,
  updated_at
)
VALUES
  ('seed-local-org-summit', 'Summit Sound Nepal', 'Summit Sound Nepal Pvt. Ltd.', 'summit@example.local', '+977-9800000101', 'master-admin-user', datetime('now'), datetime('now')),
  ('seed-local-org-food', 'Spice Route Collective', 'Spice Route Collective Pvt. Ltd.', 'spice@example.local', '+977-9800000102', 'master-admin-user', datetime('now'), datetime('now')),
  ('seed-local-org-waah', 'Waah House Events', 'Waah House Events Pvt. Ltd.', 'events@waahtickets.local', '+977-9800000103', 'master-admin-user', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  legal_name = excluded.legal_name,
  contact_email = excluded.contact_email,
  contact_phone = excluded.contact_phone,
  updated_at = datetime('now');

INSERT INTO events (
  id,
  organization_id,
  name,
  slug,
  description,
  event_type,
  start_datetime,
  end_datetime,
  status,
  is_featured,
  created_by,
  created_at,
  updated_at
)
VALUES
  (
    'seed-local-event-jazz',
    'seed-local-org-summit',
    'Kathmandu Jazz Rooftop',
    'seed-kathmandu-jazz-rooftop',
    'A warm rooftop jazz night with local bands, food stalls, and table seating.',
    'concert',
    '2026-06-20T18:30:00.000Z',
    '2026-06-20T22:30:00.000Z',
    'published',
    1,
    'master-admin-user',
    datetime('now'),
    datetime('now')
  ),
  (
    'seed-local-event-rock',
    'seed-local-org-summit',
    'Patan Rock Sessions',
    'seed-patan-rock-sessions',
    'An outdoor rock concert with general admission and VIP balcony tickets.',
    'concert',
    '2026-07-12T17:00:00.000Z',
    '2026-07-12T23:00:00.000Z',
    'published',
    1,
    'master-admin-user',
    datetime('now'),
    datetime('now')
  ),
  (
    'seed-local-event-feast',
    'seed-local-org-food',
    'Newari Feast Night',
    'seed-newari-feast-night',
    'A ticketed seven-course Newari dinner with live cultural performances.',
    'food',
    '2026-06-28T18:00:00.000Z',
    '2026-06-28T22:00:00.000Z',
    'published',
    1,
    'master-admin-user',
    datetime('now'),
    datetime('now')
  ),
  (
    'seed-local-event-comedy',
    'seed-local-org-waah',
    'Waah Comedy Showcase',
    'seed-waah-comedy-showcase',
    'A compact Friday night comedy show with reserved seats and group tickets.',
    'comedy',
    '2026-07-04T19:30:00.000Z',
    '2026-07-04T22:00:00.000Z',
    'published',
    0,
    'master-admin-user',
    datetime('now'),
    datetime('now')
  )
ON CONFLICT(id) DO UPDATE SET
  organization_id = excluded.organization_id,
  name = excluded.name,
  slug = excluded.slug,
  description = excluded.description,
  event_type = excluded.event_type,
  start_datetime = excluded.start_datetime,
  end_datetime = excluded.end_datetime,
  status = excluded.status,
  is_featured = excluded.is_featured,
  updated_at = datetime('now');

INSERT INTO event_locations (
  id,
  event_id,
  name,
  address,
  latitude,
  longitude,
  total_capacity,
  is_active,
  created_by,
  created_at,
  updated_at
)
VALUES
  ('seed-local-loc-jazz', 'seed-local-event-jazz', 'Lazimpat Rooftop Garden', 'Lazimpat, Kathmandu', 27.7177, 85.3238, 250, 1, 'master-admin-user', datetime('now'), datetime('now')),
  ('seed-local-loc-rock', 'seed-local-event-rock', 'Patan Open Air Stage', 'Patan Durbar Square, Lalitpur', 27.6726, 85.3248, 900, 1, 'master-admin-user', datetime('now'), datetime('now')),
  ('seed-local-loc-feast', 'seed-local-event-feast', 'Bhaktapur Heritage Courtyard', 'Taumadhi, Bhaktapur', 27.6710, 85.4298, 80, 1, 'master-admin-user', datetime('now'), datetime('now')),
  ('seed-local-loc-comedy', 'seed-local-event-comedy', 'Thamel Black Box', 'Thamel, Kathmandu', 27.7154, 85.3123, 180, 1, 'master-admin-user', datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  event_id = excluded.event_id,
  name = excluded.name,
  address = excluded.address,
  total_capacity = excluded.total_capacity,
  is_active = excluded.is_active,
  updated_at = datetime('now');

INSERT INTO ticket_types (
  id,
  event_id,
  event_location_id,
  name,
  description,
  price_paisa,
  currency,
  quantity_available,
  quantity_sold,
  sale_start_datetime,
  sale_end_datetime,
  min_per_order,
  max_per_order,
  is_active,
  created_at,
  updated_at
)
VALUES
  ('seed-local-tt-jazz-ga', 'seed-local-event-jazz', 'seed-local-loc-jazz', 'General Admission', 'Open seating and standing access.', 80000, 'NPR', 160, 0, '2026-05-01T00:00:00.000Z', '2026-06-20T16:00:00.000Z', 1, 6, 1, datetime('now'), datetime('now')),
  ('seed-local-tt-jazz-table', 'seed-local-event-jazz', 'seed-local-loc-jazz', 'Table Seat', 'Reserved table seat with a welcome drink.', 180000, 'NPR', 70, 0, '2026-05-01T00:00:00.000Z', '2026-06-20T16:00:00.000Z', 1, 4, 1, datetime('now'), datetime('now')),
  ('seed-local-tt-rock-ga', 'seed-local-event-rock', 'seed-local-loc-rock', 'General Standing', 'Outdoor standing area.', 60000, 'NPR', 600, 0, '2026-05-01T00:00:00.000Z', '2026-07-12T15:00:00.000Z', 1, 8, 1, datetime('now'), datetime('now')),
  ('seed-local-tt-rock-vip', 'seed-local-event-rock', 'seed-local-loc-rock', 'VIP Balcony', 'Balcony access with lounge bar.', 220000, 'NPR', 120, 0, '2026-05-01T00:00:00.000Z', '2026-07-12T15:00:00.000Z', 1, 4, 1, datetime('now'), datetime('now')),
  ('seed-local-tt-feast-seat', 'seed-local-event-feast', 'seed-local-loc-feast', 'Dinner Seat', 'One seat at the communal feast table.', 350000, 'NPR', 60, 0, '2026-05-01T00:00:00.000Z', '2026-06-27T23:00:00.000Z', 1, 2, 1, datetime('now'), datetime('now')),
  ('seed-local-tt-feast-couple', 'seed-local-event-feast', 'seed-local-loc-feast', 'Couple Package', 'Two seats with rice wine pairing.', 620000, 'NPR', 20, 0, '2026-05-01T00:00:00.000Z', '2026-06-27T23:00:00.000Z', 1, 1, 1, datetime('now'), datetime('now')),
  ('seed-local-tt-comedy-seat', 'seed-local-event-comedy', 'seed-local-loc-comedy', 'Reserved Seat', 'Reserved black box theatre seat.', 70000, 'NPR', 140, 0, '2026-05-01T00:00:00.000Z', '2026-07-04T17:00:00.000Z', 1, 6, 1, datetime('now'), datetime('now')),
  ('seed-local-tt-comedy-group', 'seed-local-event-comedy', 'seed-local-loc-comedy', 'Group of 4', 'Four reserved seats together.', 240000, 'NPR', 20, 0, '2026-05-01T00:00:00.000Z', '2026-07-04T17:00:00.000Z', 1, 1, 1, datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  event_id = excluded.event_id,
  event_location_id = excluded.event_location_id,
  name = excluded.name,
  description = excluded.description,
  price_paisa = excluded.price_paisa,
  currency = excluded.currency,
  quantity_available = excluded.quantity_available,
  quantity_sold = excluded.quantity_sold,
  sale_start_datetime = excluded.sale_start_datetime,
  sale_end_datetime = excluded.sale_end_datetime,
  min_per_order = excluded.min_per_order,
  max_per_order = excluded.max_per_order,
  is_active = excluded.is_active,
  updated_at = datetime('now');

DELETE FROM coupon_redemptions
WHERE coupon_id IN (
  'seed-local-coupon-org-summit-20',
  'seed-local-coupon-waah-500',
  'seed-local-coupon-waah-jazz-15',
  'seed-local-coupon-org-food-1000'
);

INSERT INTO coupons (
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
  issued_by_user_id,
  issued_at,
  is_active,
  created_at,
  updated_at
)
VALUES
  ('seed-local-coupon-org-summit-20', 'organizer', 'ORG-SUMMIT-20', 'waahcoupon:v1:ORG-SUMMIT-20', NULL, 'seed-local-org-summit', 'SUMMIT20', '20% off Summit Sound events only.', 'percentage', NULL, 20, 1, 0, NULL, '2026-05-01T00:00:00.000Z', NULL, '2031-05-16T00:00:00.000Z', 'master-admin-user', datetime('now'), 1, datetime('now'), datetime('now')),
  ('seed-local-coupon-waah-500', 'waah', 'WAAH-500', 'waahcoupon:v1:WAAH-500', NULL, NULL, 'WAAH500', 'NPR 500 off any event.', 'fixed', 50000, NULL, 1, 0, NULL, '2026-05-01T00:00:00.000Z', NULL, '2031-05-16T00:00:00.000Z', 'master-admin-user', datetime('now'), 1, datetime('now'), datetime('now')),
  ('seed-local-coupon-waah-jazz-15', 'waah', 'WAAH-JAZZ-15', 'waahcoupon:v1:WAAH-JAZZ-15', 'seed-local-event-jazz', NULL, 'JAZZ15', '15% off Kathmandu Jazz Rooftop only.', 'percentage', NULL, 15, 1, 0, NULL, '2026-05-01T00:00:00.000Z', NULL, '2026-06-20T22:30:00.000Z', 'master-admin-user', datetime('now'), 1, datetime('now'), datetime('now')),
  ('seed-local-coupon-org-food-1000', 'organizer', 'ORG-FOOD-1000', 'waahcoupon:v1:ORG-FOOD-1000', 'seed-local-event-feast', 'seed-local-org-food', 'FOOD1000', 'NPR 1000 off Newari Feast Night only.', 'fixed', 100000, NULL, 1, 0, 200000, '2026-05-01T00:00:00.000Z', NULL, '2026-06-28T22:00:00.000Z', 'master-admin-user', datetime('now'), 1, datetime('now'), datetime('now'))
ON CONFLICT(id) DO UPDATE SET
  coupon_type = excluded.coupon_type,
  public_code = excluded.public_code,
  qr_payload = excluded.qr_payload,
  event_id = excluded.event_id,
  organization_id = excluded.organization_id,
  code = excluded.code,
  description = excluded.description,
  discount_type = excluded.discount_type,
  discount_amount_paisa = excluded.discount_amount_paisa,
  discount_percentage = excluded.discount_percentage,
  max_redemptions = 1,
  redeemed_count = 0,
  min_order_amount_paisa = excluded.min_order_amount_paisa,
  start_datetime = excluded.start_datetime,
  end_datetime = excluded.end_datetime,
  expires_at = excluded.expires_at,
  issued_by_user_id = excluded.issued_by_user_id,
  issued_at = excluded.issued_at,
  is_active = 1,
  updated_at = datetime('now');
