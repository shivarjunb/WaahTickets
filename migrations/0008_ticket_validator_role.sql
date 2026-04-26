PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO web_roles (id, name, description, is_active, created_at, updated_at)
VALUES (
  'role-ticket-validator',
  'TicketValidator',
  'Ticket scanning and redemption access for check-in staff.',
  1,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO web_role_menu_items (
  id,
  web_role_id,
  resource_name,
  can_view,
  can_create,
  can_edit,
  can_delete,
  created_at,
  updated_at
)
VALUES
  ('menu-ticket-validator-events', 'role-ticket-validator', 'events', 1, 0, 0, 0, datetime('now'), datetime('now')),
  ('menu-ticket-validator-event-locations', 'role-ticket-validator', 'event_locations', 1, 0, 0, 0, datetime('now'), datetime('now')),
  ('menu-ticket-validator-tickets', 'role-ticket-validator', 'tickets', 1, 0, 0, 0, datetime('now'), datetime('now')),
  ('menu-ticket-validator-ticket-scans', 'role-ticket-validator', 'ticket_scans', 1, 1, 0, 0, datetime('now'), datetime('now'));
