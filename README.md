# MayBahaBa

**May baha ba?** — Crowdsourced flood-condition information for Metro Manila motorists.

MayBahaBa answers one question fast: is there a recent flood report near the
road you're about to drive? It never claims a road is "flood-free" just
because nobody has reported anything there — see [Product principles](#product-principles)
below.

This is an MVP built to the project brief in `CLAUDE.md`. It runs entirely on
free/open-source infrastructure and requires **zero paid services** to try
locally or deploy.

---

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000. No environment variables are required — the app
runs on an in-memory **mock data provider** seeded with clearly-labeled DEMO
DATA (see the banner at the top of the homepage). This lets you exercise the
whole product — search, report submission, duplicate detection, the map,
moderation — without setting up a database.

To connect a real database, see [Database setup](#database-setup) below.

---

## Architecture

```
src/
  app/
    page.tsx                     Homepage (server) → HomeClient
    admin/validate/page.tsx      Moderator queue — judge one report at a time
    admin/reports/page.tsx       Moderator ledger — every report, filters, CSV export
    privacy/page.tsx             Privacy notice
    api/
      search/route.ts            Geocoding search + reverse geocode
      reports/route.ts           POST — submit a report (validation + duplicate check)
      reports/nearby/route.ts    GET — current status for a location
      reports/pending/route.ts   GET — moderation queue (admin only)
      admin/session/route.ts     GET — is the caller a signed-in moderator? (boolean only)
      admin/reports/route.ts     GET — every report as JSON, or `?format=csv` to download
      rainfall/route.ts          GET — current rainfall near a point (Open-Meteo)
      weather-tiles/[...]/route.ts  GET — proxied rainfall map tiles (keeps the key server-side)
      reports/[id]/validate/     POST — validate/deny/flag (admin only)
      admin/login, admin/logout  Passcode session cookie
  components/                    UI components (search box, modal, map, cards)
  lib/
    types.ts                     Shared domain types + Filipino flood-depth classification
    config/                      Tunable thresholds (freshness, confidence) — no magic numbers inline
    freshness.ts, confidence.ts, duplicateDetection.ts, status.ts
    services/
      geocoding/                 GeocodingProvider interface + Nominatim (OSM) implementation
      reports/                   ReportService interface + Mock and Supabase implementations
supabase/migrations/             SQL schema, PostGIS setup, RPC functions, RLS policies
```

**Provider abstraction (spec section 31).** Nothing outside
`lib/services/*` talks to Nominatim or Supabase directly. Swapping either
provider — e.g. adding a Google Maps geocoding provider later — means
writing one new class behind the existing `GeocodingProvider` /
`ReportService` interface; no call sites change.

**Data provider selection** (`lib/services/reports/index.ts`) is automatic:
Supabase is used once `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` are set; otherwise the app falls back to the
mock provider. This is a deliberate MVP choice per the brief: "if external
API credentials are unavailable, create a clean provider interface and a
development/mock implementation rather than pretending the integration
works."

---

## Product principles

- **"No recent report" is not "no flood."** Absence of data is always
  presented as a statement about coverage, never about the road
  (`lib/status.ts`). The UI never says a road is flood-free just because no
  one has reported anything.
- **Reports expire.** A report becomes `STALE` after 3 hours and `EXPIRED`
  after 6 hours (configurable in `lib/config/freshness.ts`) and is excluded
  from "current condition" answers, though it's kept in the database for
  historical analysis.
- **Duplicates are a confidence score, not a hard rule.** Two reports at the
  same spot with different conditions ("gutter deep" then "knee deep" 15
  minutes later) are treated as separate updates, not rejected as
  duplicates. See `lib/duplicateDetection.ts`.
- **Confidence is shown as a tier, never a raw score.** "High confidence · 4
  reports" — the underlying formula (`lib/confidence.ts`) is intentionally
  simple today and designed to grow.
- **Community taps can't outweigh real reports.** See below.

## Community validation

Anyone can validate a report without an account, along two independent
axes (`components/ValidationControls.tsx`):

| Question | Actions | What it affects |
|---|---|---|
| **Baha pa rin ba?** (is it still flooded?) | Oo, may baha pa / Wala na | Currency. A confirmation sets `last_confirmed_at`, and freshness/expiry compare against `COALESCE(last_confirmed_at, reported_at)` — so an actively-confirmed report stays "current" instead of ageing out, without anyone filing a duplicate. |
| **Tama ba ito?** (was this accurate?) | Tama / Mali | Trust. Enough disputes auto-flag the report into the moderator queue. |

These are deliberately separate because they answer different questions: a
report can be perfectly accurate but no longer current.

Two safeguards worth knowing about, both deliberate:

- **A "wala na" majority does not clear a flood warning.** Letting
  anonymous taps flip the headline status would hand a griefer a way to
  hide a real hazard. Disputes are surfaced as counts and reduce
  confidence; the report otherwise ages out normally.
- **Auto-flagging never hides a report.** Hitting the dispute threshold
  (`AUTO_FLAG_INACCURATE_THRESHOLD`) only surfaces it in
  `/admin/validate` for a human to judge.

Weighting lives in `lib/config/confidence.ts`. An independent report
counts more than a community tap, and taps are capped per report, so a
handful of clicks can't manufacture "high confidence" from a single
unverified report.

**Abuse control without accounts** is layered: a per-IP rate limit, one
vote per `(report, device)` pair (a unique index in Postgres; an
in-memory set in the mock provider), and the identifier is a hash of a
browser-generated id combined with the connection — so clearing
localStorage alone doesn't buy a second vote, and no raw IP or device id
is ever stored.

---

## Database setup (optional — Supabase + PostGIS)

The mock provider is fine for evaluation, but a real deployment needs
persistent storage.

1. Create a free project at [supabase.com](https://supabase.com) (free tier
   is sufficient for MVP traffic — generous Postgres storage, PostGIS
   included).
2. In the Supabase SQL editor, run the migrations in order:
   - `supabase/migrations/0001_init.sql` — extensions, tables, PostGIS
     geography column + GIST index, `nearby_reports()` and
     `apply_report_validation()` RPC functions, and Row Level Security
     policies (public can read/insert pending reports; moderation writes
     require the service-role key).
   - `supabase/migrations/0002_seed_demo_data.sql` — **optional**, a few
     clearly-labeled demo rows for previewing a fresh project. Skip this for
     a production database.
   - `supabase/migrations/0003_community_validation.sql` — community
     validation: confirmation counters, `last_confirmed_at`, the
     one-vote-per-person unique index, and the
     `apply_community_validation` / `sweep_expired_reports` functions.
3. Copy your project URL and keys into `.env.local` (see `.env.example`):
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY` (server-only, needed for `/admin` moderation
   actions).
4. Restart the dev server. The app detects the env vars and switches to the
   Supabase provider automatically — no code changes.

**Why PostGIS?** Duplicate detection and "reports within 300m" both need
real geospatial distance queries. Storing lat/lng as plain floats and doing
Haversine math in application code (which the mock provider does, for
simplicity) doesn't scale and can't use a spatial index. The
`nearby_reports()` SQL function uses `ST_DWithin` against a GIST index —
sub-millisecond even with a large table.

---

## Map & geocoding — free vs. billable

| Service | Provider used | Cost |
|---|---|---|
| Map tiles | OpenStreetMap (`tile.openstreetmap.org`) via Leaflet | **Free**, no API key. Subject to OSM's [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) — fine for MVP traffic; a tile CDN (e.g. MapTiler's free tier) is the natural upgrade if traffic grows. |
| Geocoding / autocomplete | OpenStreetMap Nominatim (`nominatim.openstreetmap.org`) | **Free**, no API key. Subject to [Nominatim's usage policy](https://operations.osmfoundation.org/policies/nominatim/) (~1 req/sec, requires a descriptive User-Agent — already set in `lib/services/geocoding/nominatimProvider.ts`). |
| Database | Supabase (Postgres + PostGIS) | **Free tier**, sufficient for MVP. Scales to a paid tier only if traffic/storage grows significantly. |
| Hosting | Cloudflare Workers via OpenNext | **Free tier** (100k req/day) covers MVP traffic. See [Deployment](#deployment--cloudflare-workers--supabase). |

**Google Maps was deliberately not used.** Its Places/Geocoding APIs are not
fully free — they require a billing-enabled account and a usage-based
free credit that can run out. Per the project's zero-cost principle, OSM +
Nominatim + Leaflet is the default. The `GeocodingProvider` interface makes
adding a Google-backed implementation later straightforward if the product
outgrows Nominatim's rate limits — but that would be the first service in
this project capable of generating a bill, and should be a deliberate
decision, not a silent default.

---

## Fonts

The UI uses the platform's native system font stack (`ui-sans-serif` /
`-apple-system` / `Segoe UI` / Roboto / etc. — see `src/app/globals.css`)
instead of `next/font/google`. That loader needs a build-time fetch to
`fonts.googleapis.com`, which breaks builds in offline, sandboxed, or
proxied environments and adds an external dependency for no real visual
gain here. A system stack also renders with zero extra network requests,
which fits the "fast on poor mobile connections" requirement (spec section
25/45). Swap in a self-hosted `next/font/local` font if the brand needs a
custom typeface later.

## Environment variables

See `.env.example` for the full list with inline explanations. Summary:

| Variable | Required? | Billable? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No — falls back to mock data | No (free tier) |
| `SUPABASE_SERVICE_ROLE_KEY` | Only for real moderation actions | No |
| `ABUSE_HASH_SALT` | Recommended in production | No |
| `ADMIN_PASSCODE` | Required to use `/admin/validate` and `/admin/reports` | No |
| `OPENWEATHER_API_KEY` | No — without it the rainfall overlay draws nothing | No (60 calls/min free) |
| `NEXT_PUBLIC_MAP_PROVIDER` | No (informational; only `osm` is implemented) | No |

Never commit `.env.local`. It's already covered by `.gitignore`.

---

## Moderation

There are two moderator surfaces:

| Route | What it's for |
| --- | --- |
| `/admin/validate` | The queue. One report at a time, with a map, and validate/deny buttons. |
| `/admin/reports` | The ledger. Every report ever filed — including denied and expired — with status filters, text search, and a CSV export. |

Both are gated by a shared passcode (`ADMIN_PASSCODE`) stored as an httpOnly
session cookie — enough to keep them out of casual reach for an MVP with a
single moderator, but **not real authentication**. Before inviting multiple
moderators, replace `lib/admin.ts` with Supabase Auth + a `moderators`
table and per-user audit trails.

Neither is linked from the public UI. The "Report Baha" button grows a small
dropdown containing both links **only** once you already hold a valid
session — the header asks `/api/admin/session`, which returns nothing but a
boolean. A moderator who isn't signed in reaches either page by typing the
URL, and gets a passcode form in place.

### CSV export

`/api/admin/reports?format=csv` downloads the full ledger. It's CSV rather
than a real `.xlsx` so the Worker bundle stays small; Excel and Numbers both
open it natively. Two details that matter:

- A UTF-8 BOM is prepended so Excel renders `ñ` in Filipino place names
  instead of mojibake.
- Any field starting with `=`, `+`, `-` or `@` is prefixed with a single
  quote. Reporter names are attacker-controlled and anonymous, and Excel
  executes such values as formulas — see `csvCell()` in
  `api/admin/reports/route.ts`.

---

## Rainfall — what it is, and the three things it is not

The homepage shows current rainfall beneath the flood reports, sourced
from [Open-Meteo](https://open-meteo.com/) (no API key, CC BY 4.0,
10,000 calls/day on the free non-commercial tier).

This is the single easiest place in the product to break the founding
rule, so the constraints are encoded in `lib/rainfall.ts` and enforced by
tests in `lib/__tests__/rainfall.test.ts`:

1. **It is not a flood prediction.** Heavy rain does not mean the road
   ahead is flooded, and zero rain does not mean it is clear — Metro
   Manila floods from river swell, high tide, dam releases and blocked
   drainage hours after rain stops. A test asserts that no band label or
   description contains the words *baha*, *kalsada*, *daan*, *flood*,
   *road*, or *ligtas*.
2. **It is not a PAGASA advisory.** Only PAGASA can issue a Heavy
   Rainfall Warning, and only PAGASA's yellow/orange/red mean anything.
   The panel deliberately uses no colour from the flood palette, and a
   test asserts that no copy contains a warning-colour word. We link to
   [PAGASA's NCR forecast](https://www.pagasa.dost.gov.ph/regional-forecast/ncrprsd)
   for the authoritative warning.
3. **It is not a measurement.** Open-Meteo returns global weather-model
   output, not a gauge reading on that street. The UI says *tantiya*
   (estimate) for exactly this reason.

Two implementation details that carry safety weight:

- **A failure shows nothing, never a zero.** If the upstream is down,
  malformed, or missing a usable number, `fetchRainfall` throws and the
  panel renders "walang datos". Displaying "walang ulan" because an API
  timed out would be asserting something we do not know.
- **Coordinates are rounded to 2 decimal places (~1.1 km)** before
  leaving our server. This keeps the cache hit-rate high enough to stay
  inside the free tier from a globally distributed Worker, and means a
  user's precise location is never handed to a third party.

**Licence note:** the free tier is non-commercial only. If MayBahaBa ever
carries advertising or a subscription, this integration needs a paid
Open-Meteo plan or a different source. The CC BY 4.0 attribution in the
panel is a licence condition, not a courtesy — do not remove it.

---

## Rainfall map overlay

An optional tile layer over the OpenStreetMap base map, **off by
default**. Toggle it from the control under the map.

### Why OpenWeather, and why RainViewer was rejected

RainViewer looked like the obvious pick — free, no API key, purpose-built
radar. It was ruled out on two findings:

- Its personal-use tier **caps at zoom level 7**. This map operates at
  zoom 12-16, so the overlay would be an unusable blur at exactly the
  zooms motorists use.
- Its radar is stitched from national networks and there is no
  confirmation PAGASA's radar is among them, so coverage over Metro
  Manila would have been a guess.

OpenWeather's `precipitation_new` has documented worldwide coverage and
works at street zooms.

### Tiles are proxied, deliberately

`/api/weather-tiles/rainfall/{z}/{x}/{y}` fetches from OpenWeather
server-side. Two reasons:

1. **The key would otherwise be public.** OpenWeather takes it as a URL
   query parameter, so pointing Leaflet straight at them publishes it in
   every visitor's network tab. `OPENWEATHER_API_KEY` is a Worker secret,
   never a `NEXT_PUBLIC_` value. A test asserts the client-facing tile
   template contains no key parameter and does not point at
   openweathermap.org.
2. **The free tier is 60 calls/minute.** One viewport is about a dozen
   tiles, so three simultaneous users would exhaust it. Proxying lets
   Cloudflare cache each tile at the edge for 10 minutes; Metro Manila at
   these zooms is a bounded tile set, so after the first viewer most
   requests never reach OpenWeather.

### If the overlay looks empty

Three different things produce a blank overlay, and the tile proxy renders
all of them as a transparent tile, so from the map alone they are
indistinguishable. Check in this order:

```bash
curl -s https://<your-worker>/api/weather-tiles/status
# {"configured":false}  -> OPENWEATHER_API_KEY is not set
# {"configured":true}   -> key is set; check the tile header below

curl -sD - -o /dev/null \
  https://<your-worker>/api/weather-tiles/rainfall/12/3345/2020 | grep -i x-weather-tile
# not-configured   no key
# upstream-401     key rejected
# upstream-429     free-tier quota spent
# fetch-failed     provider unreachable or timed out
# (header absent)  a real tile came back - the overlay is working
```

If the header is absent and the map still looks clear, **it simply is not
raining in that view**. `precipitation_new` renders near-transparent at low
intensity, so a working overlay over dry ground looks like no overlay at
all. The UI says as much under the legend rather than leaving you to guess.

### Failure is silent, and the map keeps working

A missing key, a bad key, a quota exhaustion or an outage all return a
**transparent 1×1 PNG with status 200**, tagged with an `X-Weather-Tile`
header saying why. Returning an error status instead would make Leaflet
draw a broken-image icon in every tile slot — a map peppered with grey
squares looks far more alarming than one with no rain shown. The base
map, the report pins and every interaction keep working.

### It is context, never a flood claim

The layer says how hard it is raining. The pins say what is happening on
the road. These are not the same thing and the UI must never merge them:

- The legend is headed "Lakas ng ulan — **hindi ito lalim ng baha**" and
  states "**hindi ito babala ng baha**".
- Its palette is blues only. Tests assert no band label contains a
  PAGASA warning colour (dilaw/kahel/pula) or any road/flood word.
- Opacity is 50% so street names stay readable underneath.
- Report markers sit in Leaflet's `markerPane` (z-index 600) above the
  overlay's `tilePane` (200), and tile layers are non-interactive, so the
  overlay can never swallow a marker tap.

Enabling the layer runs in its own effect that has no access to the map
view — it cannot re-centre the map, which is what the result-card
centring behaviour depends on.

### Adding PAGASA later

`lib/weatherLayers.ts` holds a registry; the map, toggle and legend all
read from it. A PAGASA rainfall-warning layer is a new entry, not a
rewrite. Keep it a **separate** entry rather than merging: an official
warning is a different kind of claim from modelled rainfall, and it is
the one thing entitled to the yellow/orange/red scale this layer must
never borrow.

---

## Abuse prevention (MVP-level)

- **Rate limiting** — in-memory token bucket (`lib/rateLimit.ts`), stricter
  on report submission than on reads. **This is per-instance, not
  global**, and on Cloudflare Workers that is especially loose since the
  app runs in many colos, each with its own isolate. Treat it as friction
  against casual spam, not a security control. A genuinely global limit
  needs a Durable Object, Cloudflare's Rate Limiting binding, or Upstash
  Redis (free tier).
- **The limits that actually matter are enforced in Postgres** — the
  unique index on `(report_id, validator_ref)` makes double-voting
  impossible no matter which isolate serves the request.
- **Hashed identifiers only** — client IPs are hashed (`hashIdentifier`)
  before use; raw IPs are never stored or logged.
- **Server-side validation** — every report is re-validated with `zod` on
  the server (`lib/validation.ts`); client-side checks are UX only.
- **Duplicate detection** and **report expiration** double as light abuse
  resistance (spam reports age out automatically).
- CAPTCHA/bot protection was intentionally left out of V1 — it adds
  friction to the core "report in under 30 seconds" goal. If abuse becomes
  a real problem, an invisible challenge (e.g. Cloudflare Turnstile's free
  tier) is the recommended next step.

---

## Deployment — Cloudflare Workers + Supabase

MayBahaBa deploys to **Cloudflare Workers** (not Cloudflare Pages) via the
[OpenNext Cloudflare adapter](https://opennext.js.org/cloudflare).

**Why Workers rather than Pages.** Cloudflare's own Next.js framework
guide targets Workers, and the OpenNext adapter — the thing that makes a
Next.js 16 app run on Cloudflare at all — is built for Workers. Pages
isn't deprecated, but it lacks the features this app grows into (Durable
Objects for a real distributed rate limiter, Cron Triggers for cache
pruning and report expiry, proper observability). Deploying to Pages
would mean fighting the toolchain for a strictly smaller feature set.

Verified on this codebase: the Worker bundle is **~1.3 MiB gzip**, against
a 3 MiB free-plan limit, and the app has been run end-to-end in the real
`workerd` runtime (homepage, nearby lookup, community confirmation, admin
gating) — `node:crypto` works under `nodejs_compat`.

### 1. Set up Supabase

Follow [Database setup](#database-setup-optional--supabase--postgis) above
and run all migrations in order (`0001` → `0006`). A real deployment
**must** have Supabase configured: without it the app falls back to the
in-memory mock provider, and on Workers each colo has its own isolate, so
data would appear to change randomly between requests — the app would be
serving demo flood data as though it were real.

### 2. Upload the server-side secrets — once, before the first deploy

These are read by the Worker at **runtime**, so they belong in Cloudflare:

```bash
npx wrangler login
npx wrangler secret put SUPABASE_SECRET_KEY
npx wrangler secret put ADMIN_PASSCODE
npx wrangler secret put ABUSE_HASH_SALT
```

You only need to repeat this when a value changes, not on every deploy.

### 3. The `NEXT_PUBLIC_*` values are NOT secrets — do not `wrangler secret put` them

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are
**inlined into the JavaScript bundle when `next build` runs**, not read
from the environment at runtime. Uploading them as Worker secrets has no
effect on the already-compiled code, and the deployed site would silently
fall back to mock data.

They must instead be present **on the machine running the build**. Since
`npm run deploy` builds locally, `.env.local` already supplies them — so
there is nothing extra to do, as long as `.env.local` is populated before
you run the deploy.

If you later move the build into CI, set them as ordinary build-time
environment variables in the CI job, not as Worker secrets.

(This is also why the publishable key being visible in the browser is
fine: it is *designed* to be public, and is restricted by row-level
security. The secret key is the one that must never reach the client — it
bypasses RLS entirely.)

### 4. Deploy the Worker

```bash
npm run preview   # same bundle, locally in workerd — catches what `next dev` can't
npm run deploy
```

For local `npm run preview`, copy `.dev.vars.example` to `.dev.vars`
(gitignored). Note that `next dev` reads `.env.local` while the Workers
runtime reads `.dev.vars` — keep both in sync.

### 5. Check the deploy is real, not mock

Open the deployed URL and submit one test report, then confirm it appears
in Supabase's table editor. If the report vanishes on reload, or the map
shows the demo Katipunan/EDSA reports, the build didn't pick up
`NEXT_PUBLIC_SUPABASE_URL` — see step 3.

### Cost

Everything stays on free tiers: Cloudflare Workers (100k requests/day),
Supabase (Postgres + PostGIS), OpenStreetMap tiles and Nominatim
geocoding (no API key). **Nothing in this stack requires a payment method
or can generate a surprise bill.** The one thing to watch is Worker
bundle size if you add heavy dependencies — check with
`npx wrangler deploy --dry-run`.

### The Nominatim caveat — read this before going live

This is the sharpest real risk of a globally distributed deployment.
Nominatim's usage policy assumes roughly one request per second per
application and expects heavy caching. A Worker runs in many Cloudflare
colos simultaneously, each with its own memory — so a naive deployment
looks like distributed abuse and can get the whole app blocked.

`lib/services/geocoding/cachedProvider.ts` mitigates this with a
two-layer cache: a per-isolate in-memory LRU, plus the shared `locations`
table in Postgres so a search typed by one user is already cached for
everyone, in every colo. Do not remove that wrapper. If MayBahaBa gets
real traffic, budget for a dedicated geocoder (a self-hosted Nominatim
instance, or a paid provider behind the existing `GeocodingProvider`
interface) before Nominatim rate-limits you.

## Testing this MVP

```bash
npm run lint    # ESLint
npm run build   # Production build (Turbopack)
```

Manually verify, per the brief's Phase 6 checklist:

- Mobile viewport (search → result → report in under 30s)
- Desktop viewport
- Location search (try "Katipunan", "Commonwealth", "Quezon City")
- Report submission, including the duplicate-warning path (submit two
  reports near the same demo location within a few minutes)
- Community validation: confirm a report from the result card and from a
  map popup; confirm twice from the same browser (should say you've
  already voted); confirm a stale report and watch it read as current
  again
- Map interaction (pan/zoom, tap a marker, drop/drag a pin)
- `/admin/validate` sign-in and validate/deny actions
- `/admin/reports` ledger, status filters, and CSV export (incl. formula-injection escaping)
- A stale/expired demo report (see `mockProvider.ts`) does **not** appear as
  a current condition
- Keyboard-only navigation through search, modal, and admin actions
- Airplane-mode / offline submission (should show the Filipino error copy)

---

## Roadmap (not in this MVP)

Architected for, not built: route flood checker, flood alerts/subscriptions,
barangay dashboards, historical heatmaps, rainfall/government data
integrations, reporter reputation, offline/PWA support, and full moderator
authentication. See `CLAUDE.md` section 40 for the full list.
