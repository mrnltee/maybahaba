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
