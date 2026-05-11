-- ============================================================
-- Waah Tickets — Demo Events Seed
-- 20 events · 5 rails · multiple ticket types & coupons
--
-- Usage (local D1):
--   npx wrangler d1 execute DB --local --file=scripts/seed-demo-events.sql
--
-- To tear down:
--   npx wrangler d1 execute DB --local --file=scripts/seed-demo-events-teardown.sql
-- ============================================================

-- ============================================================
-- 0. Organisation
-- ============================================================
INSERT OR IGNORE INTO organizations (id, name, legal_name, contact_email, contact_phone, created_by, created_at, updated_at)
VALUES
  ('seed-org-waah',    'Waah Events Nepal',         'Waah Events Pvt. Ltd.',        'events@waahtickets.com',  '+977-1-4123456', NULL, datetime('now'), datetime('now')),
  ('seed-org-summit',  'Summit Entertainment',       'Summit Entertainment Co.',      'info@summit-ent.com.np',  '+977-1-4567890', NULL, datetime('now'), datetime('now')),
  ('seed-org-heritage','Heritage Cultural Trust',    'Heritage Cultural Trust Nepal', 'hello@heritagetrust.np',  '+977-1-4001234', NULL, datetime('now'), datetime('now')),
  ('seed-org-thrill',  'Thrill Sports Nepal',        'Thrill Sports Pvt. Ltd.',       'play@thrillsports.com.np','+977-1-5556789', NULL, datetime('now'), datetime('now')),
  ('seed-org-spice',   'Spice Route Food Group',     'Spice Route Hospitality Ltd.',  'feast@spiceroute.com.np', '+977-1-4990011', NULL, datetime('now'), datetime('now'));

-- ============================================================
-- 1. Events (20 total, mix of types, some featured)
-- ============================================================
INSERT OR IGNORE INTO events
  (id, organization_id, name, slug, description, event_type, start_datetime, end_datetime, status, is_featured, created_by, created_at, updated_at)
VALUES

('seed-evt-001', 'seed-org-summit',
 'Kathmandu Jazz Night',
 'kathmandu-jazz-night-2026',
 'An intimate evening of jazz and blues with live bands from across South Asia. Candle-lit tables, craft cocktails, and the smoothest grooves in the valley.',
 'concert', '2026-06-14 19:00:00', '2026-06-14 23:00:00', 'published', 1,
 NULL, datetime('now'), datetime('now')),

('seed-evt-002', 'seed-org-summit',
 'Valley Blues & Rock Night',
 'valley-blues-rock-night-2026',
 'Bhaktapur comes alive with an electric night of blues and rock. Six bands, one stage, limitless energy — with the backdrop of the ancient Durbar Square.',
 'concert', '2026-07-11 18:30:00', '2026-07-11 23:30:00', 'published', 1,
 NULL, datetime('now'), datetime('now')),

('seed-evt-003', 'seed-org-summit',
 'Rock at Phewa Lake',
 'rock-at-phewa-lake-2026',
 'Nepal''s biggest outdoor rock festival returns to the shores of Phewa Lake in Pokhara. Three stages, headlining acts, camping packages, and mountain views.',
 'concert', '2026-09-05 15:00:00', '2026-09-06 23:00:00', 'published', 1,
 NULL, datetime('now'), datetime('now')),

('seed-evt-004', 'seed-org-summit',
 'Dark Side Tribute Concert',
 'dark-side-tribute-concert-2026',
 'A faithful full-album recreation of Pink Floyd''s Dark Side of the Moon, performed live with a 12-piece band, lasers, and immersive visuals at Rastriya Nach Ghar.',
 'concert', '2026-09-19 19:30:00', '2026-09-19 22:30:00', 'published', 0,
 NULL, datetime('now'), datetime('now')),

('seed-evt-005', 'seed-org-waah',
 'Sitar & Soul Evening',
 'sitar-and-soul-evening-2026',
 'A rare evening of classical Hindustani music in the courtyard of Patan Museum. Master sitarist Rajan Prasad performs ragas from dusk to midnight.',
 'concert', '2026-08-22 17:00:00', '2026-08-22 22:00:00', 'published', 0,
 NULL, datetime('now'), datetime('now')),

('seed-evt-006', 'seed-org-thrill',
 'Everest Trail Run 2026',
 'everest-trail-run-2026',
 'The most legendary trail race in the world. 60 km of high-altitude terrain from Lukla to Namche Bazaar. Limited entries — book early.',
 'sports', '2026-09-26 05:00:00', '2026-09-26 18:00:00', 'published', 1,
 NULL, datetime('now'), datetime('now')),

('seed-evt-007', 'seed-org-thrill',
 'Himalayan Half Marathon',
 'himalayan-half-marathon-2026',
 'A 21 km run through Pokhara''s scenic lakeside trails with views of the Annapurna range. Open to runners of all levels. Finisher medal included.',
 'sports', '2026-08-09 06:00:00', '2026-08-09 12:00:00', 'published', 0,
 NULL, datetime('now'), datetime('now')),

('seed-evt-008', 'seed-org-thrill',
 'Sunrise Fitness Bootcamp',
 'sunrise-fitness-bootcamp-may-2026',
 'Six-session outdoor bootcamp series at Tundikhel with certified trainers. Strength, HIIT, and yoga modules. All fitness levels welcome.',
 'sports', '2026-05-23 05:30:00', '2026-05-23 07:30:00', 'published', 0,
 NULL, datetime('now'), datetime('now')),

('seed-evt-009', 'seed-org-thrill',
 'Mountain Bike Championship',
 'mountain-bike-championship-chitwan-2026',
 'Nepal''s premier mountain bike race through Chitwan''s jungle trails. Downhill, XC, and enduro categories. Prize pool of NPR 5 lakh.',
 'sports', '2026-10-03 07:00:00', '2026-10-03 17:00:00', 'published', 0,
 NULL, datetime('now'), datetime('now')),

('seed-evt-010', 'seed-org-thrill',
 'Nagarkot Yoga & Wellness Retreat',
 'nagarkot-yoga-wellness-retreat-2026',
 'A two-day wellness retreat at a mountain resort in Nagarkot. Sunrise yoga, meditation sessions, Ayurvedic meals, and guided nature walks.',
 'sports', '2026-10-17 16:00:00', '2026-10-18 14:00:00', 'published', 0,
 NULL, datetime('now'), datetime('now')),

('seed-evt-011', 'seed-org-spice',
 'Taste of Nepal Food Festival',
 'taste-of-nepal-food-festival-2026',
 'A three-day celebration of Nepali gastronomy with 40+ food stalls, live cooking demos from celebrated chefs, and a cultural stage. Patan Durbar Square.',
 'food', '2026-08-01 10:00:00', '2026-08-03 21:00:00', 'published', 1,
 NULL, datetime('now'), datetime('now')),

('seed-evt-012', 'seed-org-spice',
 'Newari Feast Experience',
 'newari-feast-experience-bhaktapur-2026',
 'An immersive Newari cuisine dinner inside a 15th-century courtyard in Bhaktapur. Seven-course traditional meal with explanations of each dish and cultural performance.',
 'food', '2026-06-27 18:00:00', '2026-06-27 22:00:00', 'published', 0,
 NULL, datetime('now'), datetime('now')),

('seed-evt-013', 'seed-org-spice',
 'Street Food Carnival',
 'street-food-carnival-kirtipur-2026',
 'Kirtipur''s best street eats, craft beer garden, live music, and artisan markets — all in one weekend. Family-friendly with a dedicated kids'' zone.',
 'food', '2026-06-06 11:00:00', '2026-06-07 21:00:00', 'published', 0,
 NULL, datetime('now'), datetime('now')),

('seed-evt-014', 'seed-org-spice',
 'Beer Garden Nights',
 'beer-garden-nights-thamel-2026',
 'Every Friday night in May & June: a rooftop beer garden in the heart of Thamel with local craft brews, bar snacks, and acoustic sets.',
 'food', '2026-05-29 17:00:00', '2026-05-29 23:00:00', 'published', 0,
 NULL, datetime('now'), datetime('now')),

('seed-evt-015', 'seed-org-waah',
 'Capital Comedy Special',
 'capital-comedy-special-2026',
 'Nepal''s top stand-up comedians headline an evening of laughs at the newly renovated City Hall auditorium. Doors open at 7 pm, show at 8 pm.',
 'comedy', '2026-06-20 20:00:00', '2026-06-20 22:30:00', 'published', 0,
 NULL, datetime('now'), datetime('now')),

('seed-evt-016', 'seed-org-waah',
 'Open Mic Comedy Night',
 'open-mic-comedy-night-may-2026',
 'Thamel''s favourite monthly open mic is back. Ten fresh comedians battle it out for the crowd''s vote. Show up, buy a drink, and laugh all night.',
 'comedy', '2026-05-30 20:30:00', '2026-05-30 23:00:00', 'published', 0,
 NULL, datetime('now'), datetime('now')),

('seed-evt-017', 'seed-org-heritage',
 'Pokhara Literary Festival',
 'pokhara-literary-festival-2026',
 'Three days of author talks, poetry slams, panel debates, and book launches by Nepali and international writers — set against the Annapurna panorama.',
 'festival', '2026-09-11 09:00:00', '2026-09-13 19:00:00', 'published', 0,
 NULL, datetime('now'), datetime('now')),

('seed-evt-018', 'seed-org-heritage',
 'Indra Jatra Cultural Mela',
 'indra-jatra-cultural-mela-2026',
 'Celebrate one of Kathmandu''s most beloved festivals with traditional mask dances, chariot processions, cultural exhibitions, and street food — right in Basantapur.',
 'festival', '2026-08-15 08:00:00', '2026-08-17 22:00:00', 'published', 1,
 NULL, datetime('now'), datetime('now')),

('seed-evt-019', 'seed-org-heritage',
 'Kathmandu Theatre Festival',
 'kathmandu-theatre-festival-2026',
 'A week-long celebration of contemporary and classical theatre from Nepal and beyond. Six productions, two stages, post-show artist Q&As.',
 'theatre', '2026-07-04 18:00:00', '2026-07-10 21:00:00', 'published', 0,
 NULL, datetime('now'), datetime('now')),

('seed-evt-020', 'seed-org-heritage',
 'Kathmandu Art Walk',
 'kathmandu-art-walk-2026',
 'Self-guided gallery trail through Patan''s finest contemporary art spaces. Participating galleries stay open late with artist talks, wine, and live painting.',
 'festival', '2026-07-25 16:00:00', '2026-07-25 21:00:00', 'published', 0,
 NULL, datetime('now'), datetime('now'));

-- ============================================================
-- 2. Event Locations
-- ============================================================
INSERT OR IGNORE INTO event_locations
  (id, event_id, name, address, latitude, longitude, total_capacity, is_active, created_by, created_at, updated_at)
VALUES

('seed-loc-001', 'seed-evt-001', 'Lazimpat Social Club',
 'Lazimpat, Kathmandu 44600', 27.7177, 85.3238, 250, 1, NULL, datetime('now'), datetime('now')),

('seed-loc-002', 'seed-evt-002', 'Bhaktapur Durbar Square Open Stage',
 'Bhaktapur Durbar Square, Bhaktapur 44800', 27.6724, 85.4280, 1200, 1, NULL, datetime('now'), datetime('now')),

('seed-loc-003', 'seed-evt-003', 'Phewa Lake Amphitheatre',
 'Lakeside, Pokhara 33700', 28.2096, 83.9556, 5000, 1, NULL, datetime('now'), datetime('now')),

('seed-loc-004', 'seed-evt-004', 'Rastriya Nach Ghar',
 'Jamal, Kathmandu 44600', 27.7101, 85.3176, 800, 1, NULL, datetime('now'), datetime('now')),

('seed-loc-005', 'seed-evt-005', 'Patan Museum Courtyard',
 'Patan Durbar Square, Lalitpur 44700', 27.6726, 85.3248, 400, 1, NULL, datetime('now'), datetime('now')),

('seed-loc-006', 'seed-evt-006', 'Namche Bazaar Starting Line',
 'Namche Bazaar, Solukhumbu 56001', 27.8059, 86.7138, 500, 1, NULL, datetime('now'), datetime('now')),

('seed-loc-007', 'seed-evt-007', 'Pokhara Lakeside Running Track',
 'Lakeside, Pokhara 33700', 28.2050, 83.9700, 1000, 1, NULL, datetime('now'), datetime('now')),

('seed-loc-008', 'seed-evt-008', 'Tundikhel Ground',
 'Tundikhel, Kathmandu 44600', 27.7040, 85.3170, 300, 1, NULL, datetime('now'), datetime('now')),

('seed-loc-009', 'seed-evt-009', 'Chitwan National Park Buffer Zone Trail',
 'Sauraha, Chitwan 44207', 27.5753, 84.4996, 200, 1, NULL, datetime('now'), datetime('now')),

('seed-loc-010', 'seed-evt-010', 'Mystic Mountain Resort Nagarkot',
 'Nagarkot, Bhaktapur 44800', 27.7163, 85.5178, 80, 1, NULL, datetime('now'), datetime('now')),

('seed-loc-011', 'seed-evt-011', 'Patan Durbar Square Grounds',
 'Patan Durbar Square, Lalitpur 44700', 27.6726, 85.3248, 8000, 1, NULL, datetime('now'), datetime('now')),

('seed-loc-012', 'seed-evt-012', 'Siddhi Binayak Couryard, Bhaktapur',
 'Suryamadhi Tole, Bhaktapur 44800', 27.6712, 85.4293, 60, 1, NULL, datetime('now'), datetime('now')),

('seed-loc-013', 'seed-evt-013', 'Kirtipur Hill Park',
 'Kirtipur, Kathmandu 44618', 27.6776, 85.2794, 3000, 1, NULL, datetime('now'), datetime('now')),

('seed-loc-014', 'seed-evt-014', 'Garden of Dreams Rooftop Annex',
 'Kaiser Mahal, Thamel, Kathmandu 44600', 27.7135, 85.3137, 180, 1, NULL, datetime('now'), datetime('now')),

('seed-loc-015', 'seed-evt-015', 'City Hall Auditorium',
 'Ratna Park, Kathmandu 44600', 27.7068, 85.3149, 600, 1, NULL, datetime('now'), datetime('now')),

('seed-loc-016', 'seed-evt-016', 'The Alley Comedy Bar',
 'Chaksibari Marg, Thamel, Kathmandu 44600', 27.7155, 85.3113, 120, 1, NULL, datetime('now'), datetime('now')),

('seed-loc-017', 'seed-evt-017', 'Pokhara Academy of Music Campus',
 'Bagar, Pokhara 33700', 28.2267, 83.9880, 2000, 1, NULL, datetime('now'), datetime('now')),

('seed-loc-018', 'seed-evt-018', 'Basantapur Durbar Square',
 'Basantapur, Kathmandu 44600', 27.7046, 85.3072, 10000, 1, NULL, datetime('now'), datetime('now')),

('seed-loc-019', 'seed-evt-019', 'Mandala Theatre',
 'Anamnagar, Kathmandu 44600', 27.6973, 85.3256, 350, 1, NULL, datetime('now'), datetime('now')),

('seed-loc-020', 'seed-evt-020', 'Patan Art Quarter',
 'Mangal Bazaar, Lalitpur 44700', 27.6710, 85.3237, 600, 1, NULL, datetime('now'), datetime('now'));

-- ============================================================
-- 3. Ticket Types  (2-3 per event)
-- ============================================================
INSERT OR IGNORE INTO ticket_types
  (id, event_id, event_location_id, name, description,
   price_paisa, currency, quantity_available, quantity_sold,
   sale_start_datetime, sale_end_datetime,
   min_per_order, max_per_order, is_active, created_at, updated_at)
VALUES

-- evt-001  Kathmandu Jazz Night
('seed-tt-001a', 'seed-evt-001', 'seed-loc-001', 'General Admission',
 'Standing / open floor area. Includes one welcome drink.',
 80000, 'NPR', 150, 0, '2026-05-01 00:00:00', '2026-06-14 17:00:00', 1, 6, 1, datetime('now'), datetime('now')),
('seed-tt-001b', 'seed-evt-001', 'seed-loc-001', 'Reserved Table Seat',
 'Assigned table seat for two. Includes welcome drinks and a charcuterie platter.',
 250000, 'NPR', 80, 0, '2026-05-01 00:00:00', '2026-06-14 17:00:00', 1, 4, 1, datetime('now'), datetime('now')),
('seed-tt-001c', 'seed-evt-001', 'seed-loc-001', 'VIP Booth',
 'Private booth for up to six. Premium bottle service, dedicated host, and meet-and-greet with performers.',
 600000, 'NPR', 5, 0, '2026-05-01 00:00:00', '2026-06-13 23:00:00', 1, 1, 1, datetime('now'), datetime('now')),

-- evt-002  Valley Blues & Rock Night
('seed-tt-002a', 'seed-evt-002', 'seed-loc-002', 'General Standing',
 'Open standing area — enjoy the full stage view from the Durbar Square grounds.',
 50000, 'NPR', 800, 0, '2026-05-15 00:00:00', '2026-07-11 16:00:00', 1, 8, 1, datetime('now'), datetime('now')),
('seed-tt-002b', 'seed-evt-002', 'seed-loc-002', 'Gold Circle',
 'Fenced premium zone closest to the stage with dedicated bar access.',
 180000, 'NPR', 300, 0, '2026-05-15 00:00:00', '2026-07-11 16:00:00', 1, 6, 1, datetime('now'), datetime('now')),
('seed-tt-002c', 'seed-evt-002', 'seed-loc-002', 'Early Bird General',
 'Discounted General Standing — available until 30 June 2026 only.',
 35000, 'NPR', 200, 0, '2026-05-15 00:00:00', '2026-06-30 23:59:00', 1, 4, 1, datetime('now'), datetime('now')),

-- evt-003  Rock at Phewa Lake
('seed-tt-003a', 'seed-evt-003', 'seed-loc-003', 'Day Pass — Saturday',
 'Access to all stages on Saturday 5 September.',
 150000, 'NPR', 2000, 0, '2026-06-01 00:00:00', '2026-09-04 23:00:00', 1, 6, 1, datetime('now'), datetime('now')),
('seed-tt-003b', 'seed-evt-003', 'seed-loc-003', 'Day Pass — Sunday',
 'Access to all stages on Sunday 6 September.',
 150000, 'NPR', 2000, 0, '2026-06-01 00:00:00', '2026-09-05 23:00:00', 1, 6, 1, datetime('now'), datetime('now')),
('seed-tt-003c', 'seed-evt-003', 'seed-loc-003', 'Weekend Pass + Camping',
 'Both days access plus a lakeside camp site for Saturday night. Festival tote included.',
 400000, 'NPR', 500, 0, '2026-06-01 00:00:00', '2026-09-03 23:00:00', 1, 4, 1, datetime('now'), datetime('now')),

-- evt-004  Dark Side Tribute Concert
('seed-tt-004a', 'seed-evt-004', 'seed-loc-004', 'Standard Seat',
 'Numbered theatre seat. Rows D–Q.',
 120000, 'NPR', 500, 0, '2026-06-01 00:00:00', '2026-09-19 17:00:00', 1, 6, 1, datetime('now'), datetime('now')),
('seed-tt-004b', 'seed-evt-004', 'seed-loc-004', 'Premium Front Row',
 'Rows A–C with unobstructed view of the projection screen.',
 250000, 'NPR', 100, 0, '2026-06-01 00:00:00', '2026-09-19 17:00:00', 1, 4, 1, datetime('now'), datetime('now')),

-- evt-005  Sitar & Soul Evening
('seed-tt-005a', 'seed-evt-005', 'seed-loc-005', 'Garden Seat',
 'Open-air courtyard seating on lawn cushions.',
 150000, 'NPR', 300, 0, '2026-06-01 00:00:00', '2026-08-22 15:00:00', 1, 4, 1, datetime('now'), datetime('now')),
('seed-tt-005b', 'seed-evt-005', 'seed-loc-005', 'Patron Package',
 'Reserved cushioned chair in the front section plus post-concert dinner with the artist.',
 500000, 'NPR', 30, 0, '2026-06-01 00:00:00', '2026-08-20 23:00:00', 1, 2, 1, datetime('now'), datetime('now')),

-- evt-006  Everest Trail Run
('seed-tt-006a', 'seed-evt-006', 'seed-loc-006', 'Standard Runner',
 'Race entry including timing chip, route map, and finisher certificate.',
 350000, 'NPR', 300, 0, '2026-04-01 00:00:00', '2026-09-20 23:00:00', 1, 1, 1, datetime('now'), datetime('now')),
('seed-tt-006b', 'seed-evt-006', 'seed-loc-006', 'Elite Runner',
 'Race entry plus pre-race briefing with elite athletes, dedicated pacer, and priority bib pickup.',
 600000, 'NPR', 50, 0, '2026-04-01 00:00:00', '2026-09-15 23:00:00', 1, 1, 1, datetime('now'), datetime('now')),
('seed-tt-006c', 'seed-evt-006', 'seed-loc-006', 'Spectator Pass',
 'Access to start/finish area and refreshment station at Namche.',
 20000, 'NPR', 500, 0, '2026-04-01 00:00:00', '2026-09-25 23:00:00', 1, 4, 1, datetime('now'), datetime('now')),

-- evt-007  Himalayan Half Marathon
('seed-tt-007a', 'seed-evt-007', 'seed-loc-007', 'Runner Entry',
 '21 km race bib, timing chip, finisher medal, and recovery snack bag.',
 200000, 'NPR', 700, 0, '2026-05-01 00:00:00', '2026-08-07 23:00:00', 1, 1, 1, datetime('now'), datetime('now')),
('seed-tt-007b', 'seed-evt-007', 'seed-loc-007', 'Fun Run (5 km)',
 'Non-competitive 5 km scenic walk/jog. T-shirt and medal included.',
 80000, 'NPR', 400, 0, '2026-05-01 00:00:00', '2026-08-08 23:00:00', 1, 4, 1, datetime('now'), datetime('now')),

-- evt-008  Sunrise Fitness Bootcamp
('seed-tt-008a', 'seed-evt-008', 'seed-loc-008', 'Single Session',
 'Drop-in pass for one bootcamp session.',
 40000, 'NPR', 200, 0, '2026-05-11 00:00:00', '2026-05-22 22:00:00', 1, 2, 1, datetime('now'), datetime('now')),
('seed-tt-008b', 'seed-evt-008', 'seed-loc-008', 'Full Series (6 sessions)',
 'Book all six Saturday morning sessions at a discounted bundle price.',
 180000, 'NPR', 50, 0, '2026-05-11 00:00:00', '2026-05-19 22:00:00', 1, 1, 1, datetime('now'), datetime('now')),

-- evt-009  Mountain Bike Championship
('seed-tt-009a', 'seed-evt-009', 'seed-loc-009', 'XC Race Entry',
 'Cross-country category race entry. Includes timing chip and trail map.',
 250000, 'NPR', 100, 0, '2026-05-01 00:00:00', '2026-10-01 23:00:00', 1, 1, 1, datetime('now'), datetime('now')),
('seed-tt-009b', 'seed-evt-009', 'seed-loc-009', 'Downhill Race Entry',
 'Downhill category entry. Helmet inspection required at check-in.',
 250000, 'NPR', 80, 0, '2026-05-01 00:00:00', '2026-10-01 23:00:00', 1, 1, 1, datetime('now'), datetime('now')),
('seed-tt-009c', 'seed-evt-009', 'seed-loc-009', 'Spectator Day Pass',
 'Full-day access to all race zones and finish-line festival.',
 30000, 'NPR', 500, 0, '2026-05-01 00:00:00', '2026-10-02 23:00:00', 1, 6, 1, datetime('now'), datetime('now')),

-- evt-010  Nagarkot Yoga Retreat
('seed-tt-010a', 'seed-evt-010', 'seed-loc-010', 'Shared Dormitory Package',
 'Two days of sessions, dormitory stay, and all Ayurvedic meals.',
 600000, 'NPR', 40, 0, '2026-06-01 00:00:00', '2026-10-10 23:00:00', 1, 1, 1, datetime('now'), datetime('now')),
('seed-tt-010b', 'seed-evt-010', 'seed-loc-010', 'Private Room Package',
 'Two days of sessions, private mountain-view room, and all Ayurvedic meals.',
 1200000, 'NPR', 20, 0, '2026-06-01 00:00:00', '2026-10-10 23:00:00', 1, 1, 1, datetime('now'), datetime('now')),

-- evt-011  Taste of Nepal Food Festival
('seed-tt-011a', 'seed-evt-011', 'seed-loc-011', 'Day Pass',
 'Single-day entry. Food tokens not included — purchase inside.',
 30000, 'NPR', 3000, 0, '2026-06-01 00:00:00', '2026-08-01 08:00:00', 1, 8, 1, datetime('now'), datetime('now')),
('seed-tt-011b', 'seed-evt-011', 'seed-loc-011', '3-Day Festival Pass',
 'Full three-day access. Includes NPR 500 worth of food tokens.',
 70000, 'NPR', 2000, 0, '2026-06-01 00:00:00', '2026-07-31 23:00:00', 1, 4, 1, datetime('now'), datetime('now')),
('seed-tt-011c', 'seed-evt-011', 'seed-loc-011', 'VIP Foodie Pass',
 'Three days plus reserved chef''s table seating, premium tasting sessions, and a cooking masterclass.',
 250000, 'NPR', 100, 0, '2026-06-01 00:00:00', '2026-07-25 23:00:00', 1, 2, 1, datetime('now'), datetime('now')),

-- evt-012  Newari Feast Experience
('seed-tt-012a', 'seed-evt-012', 'seed-loc-012', 'Dinner Seat',
 'One seat at the communal feast table. Seven-course Newari dinner.',
 350000, 'NPR', 50, 0, '2026-05-15 00:00:00', '2026-06-25 23:00:00', 1, 1, 1, datetime('now'), datetime('now')),
('seed-tt-012b', 'seed-evt-012', 'seed-loc-012', 'Couple Package',
 'Two seats at the feast table with a shared platter upgrade and rice wine pairing.',
 600000, 'NPR', 20, 0, '2026-05-15 00:00:00', '2026-06-25 23:00:00', 1, 1, 1, datetime('now'), datetime('now')),

-- evt-013  Street Food Carnival
('seed-tt-013a', 'seed-evt-013', 'seed-loc-013', 'Weekend Entry',
 'Access to both Saturday and Sunday. No food tokens — purchase inside.',
 40000, 'NPR', 2000, 0, '2026-05-01 00:00:00', '2026-06-06 09:00:00', 1, 6, 1, datetime('now'), datetime('now')),
('seed-tt-013b', 'seed-evt-013', 'seed-loc-013', 'Foodie Bundle',
 'Weekend entry plus NPR 1000 worth of food tokens.',
 120000, 'NPR', 1000, 0, '2026-05-01 00:00:00', '2026-06-05 23:00:00', 1, 4, 1, datetime('now'), datetime('now')),

-- evt-014  Beer Garden Nights
('seed-tt-014a', 'seed-evt-014', 'seed-loc-014', 'Garden Admission',
 'Entry to the rooftop garden. One welcome craft beer included.',
 60000, 'NPR', 150, 0, '2026-05-11 00:00:00', '2026-05-29 16:00:00', 1, 4, 1, datetime('now'), datetime('now')),
('seed-tt-014b', 'seed-evt-014', 'seed-loc-014', 'Brew Tasting Set',
 'Entry plus guided tasting of six craft beers with a snack pairing board.',
 180000, 'NPR', 30, 0, '2026-05-11 00:00:00', '2026-05-28 23:00:00', 1, 2, 1, datetime('now'), datetime('now')),

-- evt-015  Capital Comedy Special
('seed-tt-015a', 'seed-evt-015', 'seed-loc-015', 'General Seat',
 'Standard auditorium seating, rows H onwards.',
 80000, 'NPR', 400, 0, '2026-05-01 00:00:00', '2026-06-20 18:00:00', 1, 6, 1, datetime('now'), datetime('now')),
('seed-tt-015b', 'seed-evt-015', 'seed-loc-015', 'Premium Seat',
 'Rows B–G with better sightlines. Includes a complimentary drink voucher.',
 180000, 'NPR', 150, 0, '2026-05-01 00:00:00', '2026-06-20 18:00:00', 1, 4, 1, datetime('now'), datetime('now')),

-- evt-016  Open Mic Comedy Night
('seed-tt-016a', 'seed-evt-016', 'seed-loc-016', 'General Entry',
 'Standing room at the bar — order drinks at the counter.',
 30000, 'NPR', 100, 0, '2026-05-11 00:00:00', '2026-05-30 19:00:00', 1, 4, 1, datetime('now'), datetime('now')),

-- evt-017  Pokhara Literary Festival
('seed-tt-017a', 'seed-evt-017', 'seed-loc-017', 'Day Pass',
 'Access to all talks and panels on one chosen day.',
 60000, 'NPR', 600, 0, '2026-06-01 00:00:00', '2026-09-10 23:00:00', 1, 4, 1, datetime('now'), datetime('now')),
('seed-tt-017b', 'seed-evt-017', 'seed-loc-017', '3-Day Full Pass',
 'All three days plus access to author signing sessions.',
 150000, 'NPR', 300, 0, '2026-06-01 00:00:00', '2026-09-09 23:00:00', 1, 2, 1, datetime('now'), datetime('now')),

-- evt-018  Indra Jatra Cultural Mela
('seed-tt-018a', 'seed-evt-018', 'seed-loc-018', 'Cultural Pass (3 Days)',
 'All-access pass to the exhibition grounds and cultural stage for the full three days.',
 50000, 'NPR', 5000, 0, '2026-07-01 00:00:00', '2026-08-15 07:00:00', 1, 6, 1, datetime('now'), datetime('now')),
('seed-tt-018b', 'seed-evt-018', 'seed-loc-018', 'Heritage VIP Package',
 'Guided tour of the chariot procession route, reserved viewing platform, and a traditional welcome dinner.',
 300000, 'NPR', 50, 0, '2026-07-01 00:00:00', '2026-08-10 23:00:00', 1, 2, 1, datetime('now'), datetime('now')),

-- evt-019  Kathmandu Theatre Festival
('seed-tt-019a', 'seed-evt-019', 'seed-loc-019', 'Single Show Ticket',
 'Entry to any one production of your choice. Seat assignment at the door.',
 100000, 'NPR', 250, 0, '2026-05-15 00:00:00', '2026-07-10 16:00:00', 1, 4, 1, datetime('now'), datetime('now')),
('seed-tt-019b', 'seed-evt-019', 'seed-loc-019', 'Festival Pass (all shows)',
 'Unlimited access to all six productions across the week plus Q&A sessions.',
 500000, 'NPR', 50, 0, '2026-05-15 00:00:00', '2026-07-03 23:00:00', 1, 1, 1, datetime('now'), datetime('now')),

-- evt-020  Kathmandu Art Walk
('seed-tt-020a', 'seed-evt-020', 'seed-loc-020', 'Art Walk Pass',
 'Entry wristband for all eight participating galleries plus a route map.',
 40000, 'NPR', 500, 0, '2026-05-15 00:00:00', '2026-07-25 14:00:00', 1, 4, 1, datetime('now'), datetime('now')),
('seed-tt-020b', 'seed-evt-020', 'seed-loc-020', 'Collector''s Evening',
 'Art walk pass plus a guided tour by a senior curator and access to the private collector''s preview dinner.',
 200000, 'NPR', 40, 0, '2026-05-15 00:00:00', '2026-07-20 23:00:00', 1, 2, 1, datetime('now'), datetime('now'));

-- ============================================================
-- 4. Coupons
-- ============================================================
INSERT OR IGNORE INTO coupons
  (id, event_id, code, description, discount_type,
   discount_amount_paisa, discount_percentage,
   max_redemptions, redeemed_count, min_order_amount_paisa,
   start_datetime, end_datetime, is_active, created_at, updated_at)
VALUES

-- Jazz Night coupons
('seed-cp-001', 'seed-evt-001', 'JAZZ10',
 '10% off any Jazz Night ticket', 'percentage', NULL, 10.0,
 50, 0, 50000, '2026-05-01 00:00:00', '2026-06-13 23:59:00', 1, datetime('now'), datetime('now')),
('seed-cp-002', 'seed-evt-001', 'JAZZVIP',
 'NPR 2000 off VIP Booth bookings', 'fixed', 200000, NULL,
 5, 0, 500000, '2026-05-01 00:00:00', '2026-06-13 23:59:00', 1, datetime('now'), datetime('now')),

-- Valley Blues coupons
('seed-cp-003', 'seed-evt-002', 'EARLY20',
 '20% off when booked before 1 June', 'percentage', NULL, 20.0,
 100, 0, NULL, '2026-05-15 00:00:00', '2026-05-31 23:59:00', 1, datetime('now'), datetime('now')),
('seed-cp-004', 'seed-evt-002', 'BLUES500',
 'NPR 500 off Gold Circle tickets', 'fixed', 50000, NULL,
 80, 0, 150000, '2026-05-15 00:00:00', '2026-07-10 23:59:00', 1, datetime('now'), datetime('now')),

-- Rock at Phewa Lake
('seed-cp-005', 'seed-evt-003', 'LAKESIDE15',
 '15% off Weekend Camping Pass', 'percentage', NULL, 15.0,
 150, 0, 350000, '2026-06-01 00:00:00', '2026-08-31 23:59:00', 1, datetime('now'), datetime('now')),
('seed-cp-006', 'seed-evt-003', 'CAMP1000',
 'NPR 1000 off any pass', 'fixed', 100000, NULL,
 200, 0, 150000, '2026-06-01 00:00:00', '2026-09-03 23:59:00', 1, datetime('now'), datetime('now')),

-- Everest Trail Run
('seed-cp-007', 'seed-evt-006', 'RUN2026',
 '10% off any race entry', 'percentage', NULL, 10.0,
 60, 0, NULL, '2026-04-01 00:00:00', '2026-09-14 23:59:00', 1, datetime('now'), datetime('now')),

-- Himalayan Half Marathon
('seed-cp-008', 'seed-evt-007', 'HALFPRICE',
 'NPR 500 off Fun Run entry', 'fixed', 50000, NULL,
 100, 0, 50000, '2026-05-01 00:00:00', '2026-08-07 23:59:00', 1, datetime('now'), datetime('now')),

-- Food Festival
('seed-cp-009', 'seed-evt-011', 'FOODIE20',
 '20% off the VIP Foodie Pass', 'percentage', NULL, 20.0,
 50, 0, 200000, '2026-06-01 00:00:00', '2026-07-24 23:59:00', 1, datetime('now'), datetime('now')),
('seed-cp-010', 'seed-evt-011', 'WEEKEND50',
 'NPR 500 off the 3-Day Festival Pass', 'fixed', 50000, NULL,
 200, 0, 60000, '2026-06-01 00:00:00', '2026-07-31 23:59:00', 1, datetime('now'), datetime('now')),

-- Street Food Carnival
('seed-cp-011', 'seed-evt-013', 'STREET200',
 'NPR 200 off Weekend Entry', 'fixed', 20000, NULL,
 300, 0, 30000, '2026-05-01 00:00:00', '2026-06-05 23:59:00', 1, datetime('now'), datetime('now')),

-- Comedy Special
('seed-cp-012', 'seed-evt-015', 'LAUGH10',
 '10% off any Comedy Special ticket', 'percentage', NULL, 10.0,
 100, 0, NULL, '2026-05-01 00:00:00', '2026-06-19 23:59:00', 1, datetime('now'), datetime('now')),

-- Indra Jatra
('seed-cp-013', 'seed-evt-018', 'JATRA15',
 '15% off the Heritage VIP Package', 'percentage', NULL, 15.0,
 20, 0, 250000, '2026-07-01 00:00:00', '2026-08-09 23:59:00', 1, datetime('now'), datetime('now')),
('seed-cp-014', 'seed-evt-018', 'CULTURE100',
 'NPR 100 off Cultural Pass', 'fixed', 10000, NULL,
 500, 0, NULL, '2026-07-01 00:00:00', '2026-08-14 23:59:00', 1, datetime('now'), datetime('now')),

-- Theatre Festival
('seed-cp-015', 'seed-evt-019', 'CURTAIN25',
 '25% off the full Festival Pass', 'percentage', NULL, 25.0,
 30, 0, 400000, '2026-05-15 00:00:00', '2026-07-02 23:59:00', 1, datetime('now'), datetime('now')),

-- Yoga Retreat
('seed-cp-016', 'seed-evt-010', 'ZEN20',
 '20% off any retreat package', 'percentage', NULL, 20.0,
 25, 0, NULL, '2026-06-01 00:00:00', '2026-10-09 23:59:00', 1, datetime('now'), datetime('now'));

-- ============================================================
-- 5. Rails (stored in app_settings as JSON)
--
-- Rail layout:
--  1 – "Featured Events"      : 001, 002, 003, 006, 011, 018
--  2 – "Live Music & Concerts": 001, 002, 003, 004, 005
--  3 – "Food & Drink"         : 011, 012, 013, 014
--  4 – "Sports & Adventure"   : 006, 007, 008, 009, 010
--  5 – "Culture & Festivals"  : 017, 018, 019, 020, 015, 016
-- ============================================================

INSERT OR REPLACE INTO app_settings (setting_key, setting_value, updated_at, updated_by) VALUES ('rails_autoplay_interval_seconds', '9', datetime('now'), NULL);
INSERT OR REPLACE INTO app_settings (setting_key, setting_value, updated_at, updated_by) VALUES ('rails_filter_panel_eyebrow_text', 'BROWSE BY CATEGORY', datetime('now'), NULL);
INSERT OR REPLACE INTO app_settings (setting_key, setting_value, updated_at, updated_by) VALUES ('rails_config_json', '[{"id":"rail-featured","label":"Featured Events","eyebrow_text":"EDITORS PICKS","autoplay_enabled":true,"autoplay_interval_seconds":8,"accent_color":"#7c3aed","header_decor_image_url":"","event_ids":["seed-evt-001","seed-evt-002","seed-evt-003","seed-evt-006","seed-evt-011","seed-evt-018"]},{"id":"rail-music","label":"Live Music & Concerts","eyebrow_text":"LIVE ON STAGE","autoplay_enabled":true,"autoplay_interval_seconds":10,"accent_color":"#db2777","header_decor_image_url":"","event_ids":["seed-evt-001","seed-evt-002","seed-evt-003","seed-evt-004","seed-evt-005"]},{"id":"rail-food","label":"Food & Drink","eyebrow_text":"EAT & EXPLORE","autoplay_enabled":true,"autoplay_interval_seconds":9,"accent_color":"#d97706","header_decor_image_url":"","event_ids":["seed-evt-011","seed-evt-012","seed-evt-013","seed-evt-014"]},{"id":"rail-sports","label":"Sports & Adventure","eyebrow_text":"GET MOVING","autoplay_enabled":true,"autoplay_interval_seconds":9,"accent_color":"#059669","header_decor_image_url":"","event_ids":["seed-evt-006","seed-evt-007","seed-evt-008","seed-evt-009","seed-evt-010"]},{"id":"rail-culture","label":"Culture & Festivals","eyebrow_text":"ART THEATRE TRADITION","autoplay_enabled":true,"autoplay_interval_seconds":11,"accent_color":"#0891b2","header_decor_image_url":"","event_ids":["seed-evt-017","seed-evt-018","seed-evt-019","seed-evt-020","seed-evt-015","seed-evt-016"]}]', datetime('now'), NULL);
