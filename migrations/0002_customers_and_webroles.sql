PRAGMA foreign_keys = ON;

ALTER TABLE users ADD COLUMN webrole TEXT NOT NULL DEFAULT 'Customers';

CREATE TABLE IF NOT EXISTS web_roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_web_roles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    web_role_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (web_role_id) REFERENCES web_roles(id),
    UNIQUE (user_id, web_role_id)
);

CREATE TABLE IF NOT EXISTS web_role_menu_items (
    id TEXT PRIMARY KEY,
    web_role_id TEXT NOT NULL,
    resource_name TEXT NOT NULL,
    can_view INTEGER NOT NULL DEFAULT 1,
    can_create INTEGER NOT NULL DEFAULT 0,
    can_edit INTEGER NOT NULL DEFAULT 0,
    can_delete INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (web_role_id) REFERENCES web_roles(id),
    UNIQUE (web_role_id, resource_name)
);

CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    display_name TEXT,
    email TEXT,
    phone_number TEXT,
    billing_address TEXT,
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_users_webrole ON users(webrole);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_user_web_roles_user_id ON user_web_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_web_roles_web_role_id ON user_web_roles(web_role_id);
CREATE INDEX IF NOT EXISTS idx_web_role_menu_items_web_role_id ON web_role_menu_items(web_role_id);
CREATE INDEX IF NOT EXISTS idx_web_role_menu_items_resource_name ON web_role_menu_items(resource_name);

INSERT OR IGNORE INTO web_roles (id, name, description, created_at, updated_at)
VALUES
    ('role-customers', 'Customers', 'Customer-facing access for browsing and purchasing tickets.', datetime('now'), datetime('now')),
    ('role-organizations', 'Organizations', 'Organizer access for event, ticket, and order operations.', datetime('now'), datetime('now')),
    ('role-admin', 'Admin', 'Full administrative access across all resources.', datetime('now'), datetime('now'));

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
    ('menu-customers-customers', 'role-customers', 'customers', 1, 0, 1, 0, datetime('now'), datetime('now')),
    ('menu-customers-orders', 'role-customers', 'orders', 1, 0, 0, 0, datetime('now'), datetime('now')),
    ('menu-customers-tickets', 'role-customers', 'tickets', 1, 0, 0, 0, datetime('now'), datetime('now')),
    ('menu-organizations-organizations', 'role-organizations', 'organizations', 1, 1, 1, 0, datetime('now'), datetime('now')),
    ('menu-organizations-events', 'role-organizations', 'events', 1, 1, 1, 0, datetime('now'), datetime('now')),
    ('menu-organizations-event-locations', 'role-organizations', 'event_locations', 1, 1, 1, 0, datetime('now'), datetime('now')),
    ('menu-organizations-ticket-types', 'role-organizations', 'ticket_types', 1, 1, 1, 0, datetime('now'), datetime('now')),
    ('menu-organizations-orders', 'role-organizations', 'orders', 1, 0, 1, 0, datetime('now'), datetime('now')),
    ('menu-organizations-tickets', 'role-organizations', 'tickets', 1, 0, 1, 0, datetime('now'), datetime('now')),
    ('menu-organizations-ticket-scans', 'role-organizations', 'ticket_scans', 1, 1, 0, 0, datetime('now'), datetime('now')),
    ('menu-admin-users', 'role-admin', 'users', 1, 1, 1, 1, datetime('now'), datetime('now')),
    ('menu-admin-customers', 'role-admin', 'customers', 1, 1, 1, 1, datetime('now'), datetime('now')),
    ('menu-admin-web-roles', 'role-admin', 'web_roles', 1, 1, 1, 1, datetime('now'), datetime('now')),
    ('menu-admin-user-web-roles', 'role-admin', 'user_web_roles', 1, 1, 1, 1, datetime('now'), datetime('now')),
    ('menu-admin-web-role-menu-items', 'role-admin', 'web_role_menu_items', 1, 1, 1, 1, datetime('now'), datetime('now')),
    ('menu-admin-organizations', 'role-admin', 'organizations', 1, 1, 1, 1, datetime('now'), datetime('now')),
    ('menu-admin-organization-users', 'role-admin', 'organization_users', 1, 1, 1, 1, datetime('now'), datetime('now')),
    ('menu-admin-files', 'role-admin', 'files', 1, 1, 1, 1, datetime('now'), datetime('now')),
    ('menu-admin-events', 'role-admin', 'events', 1, 1, 1, 1, datetime('now'), datetime('now')),
    ('menu-admin-event-locations', 'role-admin', 'event_locations', 1, 1, 1, 1, datetime('now'), datetime('now')),
    ('menu-admin-ticket-types', 'role-admin', 'ticket_types', 1, 1, 1, 1, datetime('now'), datetime('now')),
    ('menu-admin-orders', 'role-admin', 'orders', 1, 1, 1, 1, datetime('now'), datetime('now')),
    ('menu-admin-order-items', 'role-admin', 'order_items', 1, 1, 1, 1, datetime('now'), datetime('now')),
    ('menu-admin-payments', 'role-admin', 'payments', 1, 1, 1, 1, datetime('now'), datetime('now')),
    ('menu-admin-tickets', 'role-admin', 'tickets', 1, 1, 1, 1, datetime('now'), datetime('now')),
    ('menu-admin-messages', 'role-admin', 'messages', 1, 1, 1, 1, datetime('now'), datetime('now')),
    ('menu-admin-notification-queue', 'role-admin', 'notification_queue', 1, 1, 1, 1, datetime('now'), datetime('now')),
    ('menu-admin-ticket-scans', 'role-admin', 'ticket_scans', 1, 1, 1, 1, datetime('now'), datetime('now')),
    ('menu-admin-coupons', 'role-admin', 'coupons', 1, 1, 1, 1, datetime('now'), datetime('now')),
    ('menu-admin-coupon-redemptions', 'role-admin', 'coupon_redemptions', 1, 1, 1, 1, datetime('now'), datetime('now'));
