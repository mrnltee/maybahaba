-- MayBahaBa — migrations 0005 + 0006, combined for the Supabase SQL editor.
--
-- Paste this whole file into the Supabase SQL Editor and press Run.
--
-- Safe to run more than once. Nothing here drops or overwrites data:
-- 0005 only adds a column and an index (both "if not exists"), and 0006
-- only replaces a function definition. If you're unsure whether you
-- already ran them, running again is the cheapest way to find out.
--
-- The last statement prints a verification table. All three columns must
-- read "OK" before report submission will work against real data.

-- ===================================================================
-- 0005 — vehicle types become multi-select
-- ===================================================================
-- A flooded street rarely affects exactly one class of vehicle, and
-- "passable for an SUV, not for a sedan" is the distinction motorists
-- actually act on.
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

-- ===================================================================
-- 0006 — area search (province / city / barangay)
-- ===================================================================
-- Answers "what's happening across this whole area?" rather than "what's
-- at this point?".
--
-- Queried by bounding box, NOT by matching the `city` text column.
-- Geocoders return name variants ("Quezon City" vs "Lungsod Quezon"), and
-- a name mismatch would silently return zero flood reports for a city
-- that has them — the most dangerous way this app can fail. A geographic
-- envelope cannot miss a report that is physically inside it.

create or replace function reports_in_area(
  min_lat double precision,
  min_lon double precision,
  max_lat double precision,
  max_lon double precision,
  max_rows integer default 200
)
returns setof reports
security definer
set search_path = public
as $$
  select r.*
    from reports r
   where r.status <> 'DENIED'
     and st_intersects(
           r.location,
           st_makeenvelope(min_lon, min_lat, max_lon, max_lat, 4326)::geography
         )
   order by coalesce(r.last_confirmed_at, r.reported_at) desc
   limit max_rows;
$$ language sql stable;

comment on function reports_in_area is
  'Reports whose point falls inside a lat/lon envelope. Uses the GIST index on reports.location.';

-- ===================================================================
-- Verification — all three must say OK
-- ===================================================================
select
  case when exists (
    select 1 from information_schema.columns
     where table_name = 'reports' and column_name = 'vehicle_types'
  ) then 'OK' else 'MISSING' end                          as "0005 vehicle_types column",
  case when exists (
    select 1 from pg_indexes
     where tablename = 'reports' and indexname = 'reports_vehicle_types_gin'
  ) then 'OK' else 'MISSING' end                          as "0005 search index",
  case when exists (
    select 1 from pg_proc where proname = 'reports_in_area'
  ) then 'OK' else 'MISSING' end                          as "0006 reports_in_area()";
