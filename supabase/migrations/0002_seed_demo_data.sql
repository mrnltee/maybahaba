-- OPTIONAL — seed data for local/staging evaluation only.
--
-- Every row here is clearly a demonstration record. Do NOT run this
-- migration against a production database; it exists so a fresh Supabase
-- project can be previewed without waiting for real community reports.
-- The app's mock provider (used when Supabase isn't configured at all)
-- ships its own separate in-memory seed — this file is only relevant if
-- you've connected a real Supabase project and want sample rows in it.

insert into reports (
  latitude, longitude, location_name, street, barangay, city, province,
  flood_depth, road_condition, vehicle_type, reported_at, reporter_name,
  anonymous, status, validation_count
) values
  (14.6349, 121.0645, 'Katipunan Avenue, Quezon City', 'Katipunan Avenue', 'Loyola Heights', 'Quezon City', 'Metro Manila',
   'GUTTER_DEEP', 'PASSABLE_WITH_CAUTION', 'SEDAN', now() - interval '12 minutes', 'Juan (DEMO)', false, 'VALIDATED', 4),
  (14.6091, 121.0223, 'Commonwealth Avenue, Quezon City', 'Commonwealth Avenue', 'Holy Spirit', 'Quezon City', 'Metro Manila',
   'HINDI_MADAANAN', 'NOT_PASSABLE', 'MOTORCYCLE', now() - interval '8 minutes', null, true, 'PENDING', 0),
  (14.5547, 121.0244, 'Makati Avenue, Makati', 'Makati Avenue', 'Bel-Air', 'Makati', 'Metro Manila',
   'WALANG_BAHA', 'PASSABLE', null, now() - interval '15 minutes', 'Mel (DEMO)', false, 'VALIDATED', 2);
