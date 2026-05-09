-- ============================================================
-- Waah Tickets - Initial D1 Database Schema
-- ============================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    first_name TEXT,
    middle_name TEXT,
    last_name TEXT,
    email TEXT UNIQUE,
    phone_number TEXT,
    password_hash TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_email_verified INTEGER NOT NULL DEFAULT 0,
    is_phone_verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);

CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    legal_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON organizations(created_by);

CREATE TABLE IF NOT EXISTS organization_users (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TEXT NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_users_organization_id ON organization_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_users_user_id ON organization_users(user_id);

CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    file_type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT,
    storage_provider TEXT NOT NULL DEFAULT 'r2',
    bucket_name TEXT,
    storage_key TEXT NOT NULL,
    public_url TEXT,
    size_bytes INTEGER,
    expires_at TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_files_file_type ON files(file_type);
CREATE INDEX IF NOT EXISTS idx_files_created_by ON files(created_by);

CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    event_type TEXT,
    start_datetime TEXT NOT NULL,
    end_datetime TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    banner_file_id TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (banner_file_id) REFERENCES files(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_events_organization_id ON events(organization_id);
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_start_datetime ON events(start_datetime);

CREATE TABLE IF NOT EXISTS event_locations (
    id TEXT PRIMARY KEY,
    event_id TEXT,
    name TEXT NOT NULL,
    address TEXT,
    latitude REAL,
    longitude REAL,
    total_capacity INTEGER,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_event_locations_event_id ON event_locations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_locations_is_active ON event_locations(is_active);
CREATE INDEX IF NOT EXISTS idx_event_locations_created_by ON event_locations(created_by);

CREATE TABLE IF NOT EXISTS ticket_types (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    event_location_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    price_paisa INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'NPR',
    quantity_available INTEGER,
    quantity_sold INTEGER NOT NULL DEFAULT 0,
    sale_start_datetime TEXT,
    sale_end_datetime TEXT,
    min_per_order INTEGER NOT NULL DEFAULT 1,
    max_per_order INTEGER,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (event_location_id) REFERENCES event_locations(id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_types_event_id ON ticket_types(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_types_event_location_id ON ticket_types(event_location_id);
CREATE INDEX IF NOT EXISTS idx_ticket_types_is_active ON ticket_types(is_active);

CREATE TABLE IF NOT EXISTS user_cart_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    item_key TEXT NOT NULL,
    event_id TEXT NOT NULL,
    event_name TEXT NOT NULL,
    event_location_id TEXT NOT NULL,
    event_location_name TEXT NOT NULL,
    ticket_type_id TEXT NOT NULL,
    ticket_type_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price_paisa INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'NPR',
    hold_token TEXT,
    hold_expires_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (event_location_id) REFERENCES event_locations(id),
    FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id),
    UNIQUE (user_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_user_cart_items_user_id ON user_cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cart_items_hold_expires ON user_cart_items(hold_expires_at);

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    customer_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    event_location_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    subtotal_amount_paisa INTEGER NOT NULL DEFAULT 0,
    discount_amount_paisa INTEGER NOT NULL DEFAULT 0,
    tax_amount_paisa INTEGER NOT NULL DEFAULT 0,
    total_amount_paisa INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'NPR',
    order_datetime TEXT NOT NULL,
    expires_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES users(id),
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (event_location_id) REFERENCES event_locations(id)
);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_event_id ON orders(event_id);
CREATE INDEX IF NOT EXISTS idx_orders_event_location_id ON orders(event_location_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_order_datetime ON orders(order_datetime);

CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    ticket_type_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price_paisa INTEGER NOT NULL,
    subtotal_amount_paisa INTEGER NOT NULL,
    discount_amount_paisa INTEGER NOT NULL DEFAULT 0,
    total_amount_paisa INTEGER NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_ticket_type_id ON order_items(ticket_type_id);

CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    payment_provider TEXT NOT NULL DEFAULT 'khalti',
    khalti_pidx TEXT,
    khalti_transaction_id TEXT,
    khalti_purchase_order_id TEXT,
    amount_paisa INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'NPR',
    status TEXT NOT NULL DEFAULT 'initiated',
    payment_datetime TEXT,
    verified_datetime TEXT,
    raw_request TEXT,
    raw_response TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (customer_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_khalti_pidx ON payments(khalti_pidx);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_payment_provider ON payments(payment_provider);

CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    ticket_number TEXT NOT NULL UNIQUE,
    order_id TEXT NOT NULL,
    order_item_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    event_location_id TEXT NOT NULL,
    ticket_type_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    qr_code_value TEXT NOT NULL UNIQUE,
    barcode_value TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    is_paid INTEGER NOT NULL DEFAULT 0,
    redeemed_at TEXT,
    redeemed_by TEXT,
    pdf_file_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (order_item_id) REFERENCES order_items(id),
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (event_location_id) REFERENCES event_locations(id),
    FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id),
    FOREIGN KEY (customer_id) REFERENCES users(id),
    FOREIGN KEY (redeemed_by) REFERENCES users(id),
    FOREIGN KEY (pdf_file_id) REFERENCES files(id)
);

CREATE INDEX IF NOT EXISTS idx_tickets_order_id ON tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_tickets_order_item_id ON tickets(order_item_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event_id ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event_location_id ON tickets(event_location_id);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_type_id ON tickets(ticket_type_id);
CREATE INDEX IF NOT EXISTS idx_tickets_customer_id ON tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_qr_code_value ON tickets(qr_code_value);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    message_type TEXT NOT NULL,
    subject TEXT,
    content TEXT NOT NULL,
    recipient_email TEXT,
    recipient_phone TEXT,
    regarding_entity_type TEXT,
    regarding_entity_id TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_message_type ON messages(message_type);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_regarding_entity ON messages(regarding_entity_type, regarding_entity_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_email ON messages(recipient_email);

CREATE TABLE IF NOT EXISTS notification_queue (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    queued_at TEXT,
    sent_at TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    provider TEXT,
    provider_message_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_message_id ON notification_queue(message_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_channel ON notification_queue(channel);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue(status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_queued_at ON notification_queue(queued_at);

CREATE TABLE IF NOT EXISTS ticket_scans (
    id TEXT PRIMARY KEY,
    ticket_id TEXT,
    scanned_by TEXT,
    event_id TEXT NOT NULL,
    event_location_id TEXT NOT NULL,
    scan_result TEXT NOT NULL,
    scan_message TEXT,
    scanned_at TEXT NOT NULL,
    device_info TEXT,
    ip_address TEXT,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id),
    FOREIGN KEY (scanned_by) REFERENCES users(id),
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (event_location_id) REFERENCES event_locations(id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_scans_ticket_id ON ticket_scans(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_scans_event_id ON ticket_scans(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_scans_event_location_id ON ticket_scans(event_location_id);
CREATE INDEX IF NOT EXISTS idx_ticket_scans_scanned_by ON ticket_scans(scanned_by);
CREATE INDEX IF NOT EXISTS idx_ticket_scans_scanned_at ON ticket_scans(scanned_at);
CREATE INDEX IF NOT EXISTS idx_ticket_scans_scan_result ON ticket_scans(scan_result);

CREATE TABLE IF NOT EXISTS coupons (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT,
    discount_type TEXT NOT NULL,
    discount_amount_paisa INTEGER,
    discount_percentage REAL,
    max_redemptions INTEGER,
    redeemed_count INTEGER NOT NULL DEFAULT 0,
    min_order_amount_paisa INTEGER,
    start_datetime TEXT,
    end_datetime TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (event_id) REFERENCES events(id),
    UNIQUE (event_id, code)
);

CREATE INDEX IF NOT EXISTS idx_coupons_event_id ON coupons(event_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON coupons(is_active);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id TEXT PRIMARY KEY,
    coupon_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    discount_amount_paisa INTEGER NOT NULL DEFAULT 0,
    redeemed_at TEXT NOT NULL,
    FOREIGN KEY (coupon_id) REFERENCES coupons(id),
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (customer_id) REFERENCES users(id),
    UNIQUE (coupon_id, order_id)
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon_id ON coupon_redemptions(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_order_id ON coupon_redemptions(order_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_customer_id ON coupon_redemptions(customer_id);
