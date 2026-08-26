-- MayBahaBa — vehicle types become multi-select
--
-- A flooded street rarely affects exactly one class of vehicle, and
-- "passable for an SUV, not for a sedan" is the distinction motorists
-- actually act on. Run after 0004.
--
-- The legacy `vehicle_type` column is kept, not dropped: existing rows
-- keep their data, and the app reads the array first and falls back to
-- the single value. Drop it in a later migration once you're satisfied
-- nothing depends on it.

alter table reports
  add column if not exists vehicle_types vehicle_type[] not null default '{}';

-- Backfill the array from whatever single value a row already had.
update reports
   set vehicle_types = array[vehicle_type]
 where vehicle_type is not null
   and (vehicle_types is null or cardinality(vehicle_types) = 0);

-- Lets "which reports affected motorcycles?" stay fast as data grows.
create index if not exists reports_vehicle_types_gin on reports using gin (vehicle_types);

comment on column reports.vehicle_type is
  'DEPRECATED — superseded by vehicle_types. Retained so pre-0005 rows keep their value.';
