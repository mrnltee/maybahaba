-- MayBahaBa — area search (province / city / barangay)
--
-- Answers "what's happening across this whole area?" rather than "what's
-- at this point?". Run after 0005.
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
