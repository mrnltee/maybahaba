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
