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
