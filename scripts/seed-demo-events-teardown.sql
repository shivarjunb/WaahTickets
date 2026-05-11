-- ============================================================
-- Waah Tickets — Demo Events Seed Teardown
-- Removes everything inserted by seed-demo-events.sql
--
-- Usage (local D1):
--   npx wrangler d1 execute DB --local --file=scripts/seed-demo-events-teardown.sql
-- ============================================================

PRAGMA foreign_keys = ON;

-- Coupons
DELETE FROM coupons WHERE id IN (
  'seed-cp-001','seed-cp-002','seed-cp-003','seed-cp-004',
  'seed-cp-005','seed-cp-006','seed-cp-007','seed-cp-008',
  'seed-cp-009','seed-cp-010','seed-cp-011','seed-cp-012',
  'seed-cp-013','seed-cp-014','seed-cp-015','seed-cp-016'
);

-- Ticket types
DELETE FROM ticket_types WHERE id IN (
  'seed-tt-001a','seed-tt-001b','seed-tt-001c',
  'seed-tt-002a','seed-tt-002b','seed-tt-002c',
  'seed-tt-003a','seed-tt-003b','seed-tt-003c',
  'seed-tt-004a','seed-tt-004b',
  'seed-tt-005a','seed-tt-005b',
  'seed-tt-006a','seed-tt-006b','seed-tt-006c',
  'seed-tt-007a','seed-tt-007b',
  'seed-tt-008a','seed-tt-008b',
  'seed-tt-009a','seed-tt-009b','seed-tt-009c',
  'seed-tt-010a','seed-tt-010b',
  'seed-tt-011a','seed-tt-011b','seed-tt-011c',
  'seed-tt-012a','seed-tt-012b',
  'seed-tt-013a','seed-tt-013b',
  'seed-tt-014a','seed-tt-014b',
  'seed-tt-015a','seed-tt-015b',
  'seed-tt-016a',
  'seed-tt-017a','seed-tt-017b',
  'seed-tt-018a','seed-tt-018b',
  'seed-tt-019a','seed-tt-019b',
  'seed-tt-020a','seed-tt-020b'
);

-- Event locations
DELETE FROM event_locations WHERE id IN (
  'seed-loc-001','seed-loc-002','seed-loc-003','seed-loc-004','seed-loc-005',
  'seed-loc-006','seed-loc-007','seed-loc-008','seed-loc-009','seed-loc-010',
  'seed-loc-011','seed-loc-012','seed-loc-013','seed-loc-014','seed-loc-015',
  'seed-loc-016','seed-loc-017','seed-loc-018','seed-loc-019','seed-loc-020'
);

-- Events
DELETE FROM events WHERE id IN (
  'seed-evt-001','seed-evt-002','seed-evt-003','seed-evt-004','seed-evt-005',
  'seed-evt-006','seed-evt-007','seed-evt-008','seed-evt-009','seed-evt-010',
  'seed-evt-011','seed-evt-012','seed-evt-013','seed-evt-014','seed-evt-015',
  'seed-evt-016','seed-evt-017','seed-evt-018','seed-evt-019','seed-evt-020'
);

-- Organisations
DELETE FROM organizations WHERE id IN (
  'seed-org-waah','seed-org-summit','seed-org-heritage',
  'seed-org-thrill','seed-org-spice'
);

-- Rails settings
DELETE FROM app_settings WHERE setting_key IN (
  'rails_autoplay_interval_seconds',
  'rails_filter_panel_eyebrow_text',
  'rails_config_json'
);
