CREATE TABLE IF NOT EXISTS cart_holds (
    id TEXT PRIMARY KEY,
    hold_token TEXT NOT NULL,
    ticket_type_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    event_location_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id),
    FOREIGN KEY (event_id) REFERENCES events(id),
    FOREIGN KEY (event_location_id) REFERENCES event_locations(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_holds_token_ticket_type ON cart_holds(hold_token, ticket_type_id);
CREATE INDEX IF NOT EXISTS idx_cart_holds_ticket_type_expires ON cart_holds(ticket_type_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_cart_holds_hold_token ON cart_holds(hold_token);
