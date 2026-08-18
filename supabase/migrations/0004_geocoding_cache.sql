-- MayBahaBa — geocoding cache support
--
-- The `locations` table from 0001 stored only a PostGIS geography point.
-- The application cache reads and writes plain latitude/longitude (it
-- never does spatial queries against this table), so mirror the pattern
-- already used by `reports`: lat/lng columns kept in sync with the
-- geography by a trigger.
--
-- WHY A SHARED CACHE: on a globally distributed deployment (Cloudflare
-- Workers), each colo has its own isolate and therefore its own memory.
-- Without a shared cache every colo would hit Nominatim independently,
-- which breaches its usage policy and risks the app being blocked.
-- Run after 0001_init.sql.

alter table locations
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

-- Let rows be inserted with lat/lng only; the trigger fills `location`.
alter table locations alter column location drop not null;

create or replace function locations_sync_location()
returns trigger as $$
begin
  if new.latitude is not null and new.longitude is not null then
    new.location := st_setsrid(st_makepoint(new.longitude, new.latitude), 4326)::geography;
  elsif new.location is not null then
    new.latitude := st_y(new.location::geometry);
    new.longitude := st_x(new.location::geometry);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists locations_sync_location_trigger on locations;
create trigger locations_sync_location_trigger
before insert or update on locations
for each row execute function locations_sync_location();

-- Backfill lat/lng for any rows written before this migration.
update locations
   set latitude = st_y(location::geometry),
       longitude = st_x(location::geometry)
 where latitude is null and location is not null;

-- One row per (query, label) so repeated searches upsert instead of
-- growing the table without bound.
create unique index if not exists locations_query_label_key
  on locations (query, label);

create index if not exists locations_created_at_idx on locations (created_at);

-- The cache writes with UPSERT, which needs UPDATE as well as INSERT.
-- Migration 0001 only granted SELECT/INSERT, so without this a repeat
-- search on an expired cache entry fails the RLS check and the entry can
-- never be refreshed. This table holds nothing but public OSM data.
drop policy if exists locations_public_update on locations;
create policy locations_public_update on locations
  for update using (true) with check (true);

-- ---------------------------------------------------------------------
-- Cache hygiene
-- ---------------------------------------------------------------------
-- Cached geocoding results go stale as OSM data changes. Call this
-- periodically (a Cloudflare Cron Trigger, a Supabase scheduled job, or
-- by hand) to drop entries older than the given age.
create or replace function prune_location_cache(max_age_days integer default 30)
returns integer
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with pruned as (
    delete from locations
     where created_at < now() - make_interval(days => max_age_days)
     returning id
  )
  select count(*) into v_count from pruned;
  return v_count;
end;
$$ language plpgsql;
