-- Add map fields to events table for hero map integration
ALTER TABLE events ADD COLUMN location_lat REAL;
ALTER TABLE events ADD COLUMN location_lng REAL;
ALTER TABLE events ADD COLUMN map_pin_icon TEXT;
ALTER TABLE events ADD COLUMN map_popup_config TEXT;
