-- ============================================================
-- MayBahaBa — complete database setup (all migrations combined)
--
-- Paste this whole file into the Supabase SQL Editor and press Run.
-- It is the concatenation of, in order:
--   0001_init.sql                  schema, PostGIS, RLS
--   0003_community_validation.sql  community confirmations
--   0004_geocoding_cache.sql       shared geocoding cache
--
-- 0002_seed_demo_data.sql is deliberately NOT included — that file only
-- inserts clearly-labeled DEMO rows and should not go into a database
-- that will hold real community reports.
--
-- Safe to re-run. Verified against PostgreSQL 16 + PostGIS 3.4, applied
-- twice in a row as a single transaction with no errors.
-- ============================================================


-- ============================================================
-- BEGIN 0001_init.sql
-- ============================================================

-- MayBahaBa — initial schema
-- Requires the PostGIS extension (available on Supabase's free tier).
--
-- Run this against a Supabase project via the SQL editor, or with the
-- Supabase CLI: `supabase db push`. See README.md for full setup steps.

create extension if not exists postgis;
create extension if not exists pgcrypto; -- for gen_random_uuid()

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------

-- Postgres has no CREATE TYPE ... IF NOT EXISTS, so each enum is wrapped
-- in a DO block that swallows duplicate_object. This makes the whole file
-- safe to re-run, which matters because it is also shipped concatenated
-- as supabase/SETUP_ALL.sql for pasting into the Supabase SQL editor.
do $$ begin
  create type flood_depth as enum (
    'WALANG_BAHA',
    'GUTTER_DEEP',
    'BUKONG_BUKONG',
    'BINTI',
    'TUHOD',
    'HITA',
    'BAYWANG',
    'HINDI_MADAANAN'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type road_condition as enum (
    'PASSABLE',
    'PASSABLE_WITH_CAUTION',
    'DIFFICULT',
    'NOT_PASSABLE'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type vehicle_type as enum (
    'MOTORCYCLE',
    'SEDAN',
    'SUV',
    'TRUCK',
    'JEEPNEY',
    'OTHER'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type report_status as enum (
    'PENDING',
    'VALIDATED',
    'DENIED',
    'EXPIRED',
    'FLAGGED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type validation_action as enum ('VALIDATE', 'DENY', 'FLAG');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),

  -- Precise point, stored as PostGIS geography (not plain text) so we get
  -- accurate great-circle distance queries and a proper spatial index.
  location geography(Point, 4326) not null,
  latitude double precision not null,
  longitude double precision not null,

  location_name text not null,
  street text,
  barangay text,
  city text,
  province text,

  flood_depth flood_depth not null,
  road_condition road_condition,
  vehicle_type vehicle_type,

  -- Exact centimeter measurement, optional, for future precise reporting
  -- (spec section 8: "design the database so exact measurements can be
  -- supported later"). Not collected in the V1 UI.
  depth_cm integer,

  reported_at timestamptz not null,
  reporter_name text,
  anonymous boolean not null default true,

  status report_status not null default 'PENDING',
  confidence_score real not null default 0,
  validation_count integer not null default 0,
  deny_count integer not null default 0,

  -- Hashed submitter identifier (never a raw IP) for abuse/rate-limit
  -- purposes only. Never exposed to clients.
  submitter_hash text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint reporter_name_length check (char_length(coalesce(reporter_name, '')) <= 60),
  constraint location_name_length check (char_length(location_name) between 1 and 200)
);

create index if not exists reports_location_gix on reports using gist (location);
create index if not exists reports_reported_at_idx on reports (reported_at desc);
create index if not exists reports_status_idx on reports (status);

-- Keep `location` in sync with latitude/longitude on insert/update so
-- callers can just write lat/lng columns and never touch PostGIS types
-- directly.
create or replace function reports_sync_location()
returns trigger as $$
begin
  new.location := st_setsrid(st_makepoint(new.longitude, new.latitude), 4326)::geography;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists reports_sync_location_trigger on reports;
create trigger reports_sync_location_trigger
before insert or update on reports
for each row execute function reports_sync_location();

-- ---------------------------------------------------------------------
-- report_validations
-- ---------------------------------------------------------------------

create table if not exists report_validations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  -- Anonymous/hashed validator identifier (browser-generated id or admin
  -- session id) — never a raw IP or account id in V1.
  validator_ref text not null,
  action validation_action not null,
  created_at timestamptz not null default now()
);

create index if not exists report_validations_report_id_idx on report_validations (report_id);

-- Recompute status/counters on a report from its validation history.
-- Called by the app after inserting a validation row.
-- SECURITY DEFINER: `reports` has no public UPDATE policy by design, so
-- this controlled function is the only way the status/counters change.
-- search_path is pinned because the function runs with owner privileges.
create or replace function apply_report_validation(p_report_id uuid, p_action validation_action)
returns reports
security definer
set search_path = public
as $$
declare
  v_report reports;
  v_validate_count integer;
  v_deny_count integer;
begin
  select count(*) filter (where action = 'VALIDATE'),
         count(*) filter (where action = 'DENY')
    into v_validate_count, v_deny_count
    from report_validations
   where report_id = p_report_id;

  update reports
     set validation_count = v_validate_count,
         deny_count = v_deny_count,
         status = case
           when p_action = 'FLAG' then 'FLAGGED'::report_status
           when v_deny_count >= 1 then 'DENIED'::report_status
           when v_validate_count >= 1 then 'VALIDATED'::report_status
           else status
         end,
         updated_at = now()
   where id = p_report_id
   returning * into v_report;

  return v_report;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------
-- locations (optional geocoding cache, spec section 22)
-- ---------------------------------------------------------------------

create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  label text not null,
  location geography(Point, 4326) not null,
  street text,
  barangay text,
  city text,
  province text,
  kind text,
  created_at timestamptz not null default now()
);

create index if not exists locations_query_idx on locations (query);
create index if not exists locations_location_gix on locations using gist (location);

-- ---------------------------------------------------------------------
-- Spatial query: nearby_reports(center_lat, center_lng, radius_m)
-- ---------------------------------------------------------------------

create or replace function nearby_reports(center_lat double precision, center_lng double precision, radius_m double precision)
returns setof reports as $$
  select r.*
    from reports r
   where r.status <> 'DENIED'
     and st_dwithin(r.location, st_setsrid(st_makepoint(center_lng, center_lat), 4326)::geography, radius_m)
   order by r.reported_at desc;
$$ language sql stable;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table reports enable row level security;
alter table report_validations enable row level security;
alter table locations enable row level security;

-- Public (anon key) can read all non-denied reports...
drop policy if exists reports_public_read on reports;
create policy reports_public_read on reports
  for select using (status <> 'DENIED');

-- ...and can insert a new PENDING report, but cannot set status,
-- confidence, or validation counters directly (server-side defaults win;
-- attempts to submit other values are rejected).
drop policy if exists reports_public_insert on reports;
create policy reports_public_insert on reports
  for insert with check (
    status = 'PENDING' and confidence_score = 0 and validation_count = 0 and deny_count = 0
  );

-- No public UPDATE/DELETE policy is created: moderation writes must go
-- through the service-role key (server-side /admin routes only).

drop policy if exists validations_public_read on report_validations;
create policy validations_public_read on report_validations
  for select using (true);

drop policy if exists validations_public_insert on report_validations;
create policy validations_public_insert on report_validations
  for insert with check (true);

drop policy if exists locations_public_read on locations;
create policy locations_public_read on locations
  for select using (true);

drop policy if exists locations_public_insert on locations;
create policy locations_public_insert on locations
  for insert with check (true);

-- ============================================================
-- BEGIN 0003_community_validation.sql
-- ============================================================

-- MayBahaBa — community validation (spec section 16)
--
-- Adds public, account-free confirmation of reports along two independent
-- axes: currency ("baha pa rin ba?") and accuracy ("tama ba ito?").
-- Run after 0001_init.sql.

-- ---------------------------------------------------------------------
-- Community actions
-- ---------------------------------------------------------------------
-- `report_validations.action` already holds moderator actions; extend the
-- same enum so one table records both, distinguishable by value.
alter type validation_action add value if not exists 'STILL_FLOODED';
alter type validation_action add value if not exists 'NO_LONGER_FLOODED';
alter type validation_action add value if not exists 'ACCURATE';
alter type validation_action add value if not exists 'INACCURATE';

-- ---------------------------------------------------------------------
-- Counters on reports
-- ---------------------------------------------------------------------
alter table reports
  add column if not exists still_flooded_count integer not null default 0,
  add column if not exists no_longer_flooded_count integer not null default 0,
  add column if not exists accurate_count integer not null default 0,
  add column if not exists inaccurate_count integer not null default 0,
  -- When the community last confirmed the flooding is STILL happening.
  -- Freshness/expiry compare against COALESCE(last_confirmed_at,
  -- reported_at) so an actively-confirmed report stays current.
  add column if not exists last_confirmed_at timestamptz;

create index if not exists reports_effective_time_idx
  on reports (coalesce(last_confirmed_at, reported_at) desc);

-- ---------------------------------------------------------------------
-- One COMMUNITY vote per person per report
-- ---------------------------------------------------------------------
-- validator_ref is an anonymous, hashed identifier — never a raw IP.
-- A duplicate insert raises 23505, which the app reads as "already voted".
--
-- This index is PARTIAL, and deliberately so: moderators legitimately act
-- on the same report more than once (validate now, flag later), so a
-- blanket unique index on (report_id, validator_ref) would break
-- /admin/validate with a constraint violation.
--
-- The predicate lists the three MODERATOR actions rather than the four
-- community ones because those values already existed before this
-- migration. Postgres refuses to use an enum value added in the current
-- transaction, so referencing the new values here would fail whenever
-- this file is run as a single transaction (as some SQL editors do).
create unique index if not exists report_validations_one_community_vote
  on report_validations (report_id, validator_ref)
  where action not in ('VALIDATE', 'DENY', 'FLAG');

-- ---------------------------------------------------------------------
-- Apply a community confirmation atomically
-- ---------------------------------------------------------------------
-- SECURITY DEFINER, and it performs the dedupe insert ITSELF.
--
-- Two reasons this function owns the whole operation rather than just the
-- counter update:
--
--  1. RLS. `reports` intentionally has no public UPDATE policy, so an
--     anon-key caller updating it directly would silently affect zero
--     rows — failing quietly, which is worse than erroring.
--  2. Bypass resistance. If the vote row were inserted by the client and
--     only the counter bump lived here, anyone with the (public) anon key
--     could call this RPC in a loop and inflate counters without ever
--     tripping the one-vote unique index. Doing both together makes the
--     index the real gate.
--
-- `set search_path` is pinned because SECURITY DEFINER functions run with
-- the owner's privileges and must not resolve objects from a caller
-- controlled schema.
create or replace function apply_community_validation(
  p_report_id uuid,
  p_action validation_action,
  p_validator_ref text
)
returns reports
security definer
set search_path = public
as $$
declare
  v_report reports;
  v_inserted boolean;
begin
  -- Community actions only — never let this path record moderator verdicts.
  if p_action in ('VALIDATE', 'DENY', 'FLAG') then
    raise exception 'apply_community_validation does not accept moderator action %', p_action;
  end if;

  insert into report_validations (report_id, validator_ref, action)
  values (p_report_id, p_validator_ref, p_action)
  on conflict do nothing
  returning true into v_inserted;

  -- Already voted on this report — report it as such, change nothing.
  if v_inserted is null then
    return null;
  end if;

  update reports
     set still_flooded_count = still_flooded_count + (p_action = 'STILL_FLOODED')::int,
         no_longer_flooded_count = no_longer_flooded_count + (p_action = 'NO_LONGER_FLOODED')::int,
         accurate_count = accurate_count + (p_action = 'ACCURATE')::int,
         inaccurate_count = inaccurate_count + (p_action = 'INACCURATE')::int,
         last_confirmed_at = case
           when p_action = 'STILL_FLOODED' then now()
           else last_confirmed_at
         end,
         updated_at = now()
   where id = p_report_id
   returning * into v_report;

  -- Auto-flag for moderator review once enough people dispute accuracy.
  -- This only surfaces the report in the moderation queue; it never hides
  -- or deletes it, which would let a griefer suppress a real hazard.
  if v_report.inaccurate_count >= 3
     and v_report.inaccurate_count > v_report.accurate_count
     and v_report.status <> 'DENIED' then
    update reports
       set status = 'FLAGGED', updated_at = now()
     where id = p_report_id
     returning * into v_report;
  end if;

  return v_report;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------
-- Expire stale reports against their EFFECTIVE timestamp
-- ---------------------------------------------------------------------
-- SECURITY DEFINER: called on ordinary reads with the anon key, and
-- `reports` has no public UPDATE policy (see note above).
create or replace function sweep_expired_reports(expiry_minutes integer)
returns integer
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with expired as (
    update reports
       set status = 'EXPIRED', updated_at = now()
     where status not in ('EXPIRED', 'DENIED')
       and coalesce(last_confirmed_at, reported_at) < now() - make_interval(mins => expiry_minutes)
     returning id
  )
  select count(*) into v_count from expired;
  return v_count;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------
-- Nearby reports: order by effective recency
-- ---------------------------------------------------------------------
create or replace function nearby_reports(center_lat double precision, center_lng double precision, radius_m double precision)
returns setof reports as $$
  select r.*
    from reports r
   where r.status <> 'DENIED'
     and st_dwithin(r.location, st_setsrid(st_makepoint(center_lng, center_lat), 4326)::geography, radius_m)
   order by coalesce(r.last_confirmed_at, r.reported_at) desc;
$$ language sql stable;

-- ============================================================
-- BEGIN 0004_geocoding_cache.sql
-- ============================================================

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
