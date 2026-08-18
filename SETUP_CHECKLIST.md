# MayBahaBa — setup checklist

Work through these in order. Anything marked **[you]** needs your accounts
and can't be done for you.

---

## 0. Reinstall dependencies (do this first)

The project gained the Cloudflare adapter, so your `node_modules` is out
of date. If you see `Cannot find module '@opennextjs/cloudflare'`, this is
why:

```bash
cd ~/dev/claude-projects/MayBahaBa/maybahaba
npm install
npm run dev
```

The app should come up on http://localhost:3000 running on demo data.

---

## 1. **[you]** Create the Supabase project

1. Go to https://supabase.com and sign in (GitHub login is fastest).
2. **New project.** Name it `maybahaba`. Choose the **Southeast Asia
   (Singapore)** region — it's the closest to your users, and it's free.
3. Set a database password. Save it in your password manager; you won't
   need it for this app, but you'll want it later.
4. Wait ~2 minutes for provisioning.

## 2. **[you]** Run the database setup

1. In your project, open **SQL Editor** → **New query**.
2. Paste the entire contents of `supabase/SETUP_ALL.sql` and press **Run**.
3. Expect "Success. No rows returned."

That one file replaces running the four migrations separately. It's been
verified against PostgreSQL 16 + PostGIS 3.4 and is safe to run more than
once, so if you're unsure whether it applied, just run it again.

**Do not** run `supabase/migrations/0002_seed_demo_data.sql` against this
database — it inserts fake reports, which is exactly what a real flood
database should never contain.

### Confirm it worked

In the SQL Editor:

```sql
select count(*) as tables from pg_tables where schemaname = 'public';
-- expect 4 (reports, report_validations, locations, spatial_ref_sys)

select proname from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and proname in ('nearby_reports','apply_community_validation',
                   'apply_report_validation','sweep_expired_reports',
                   'prune_location_cache');
-- expect all 5
```

## 3. **[you]** Get your API keys

**Project Settings** → **API**. You need:

| Supabase calls it | Goes into |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` / `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` |

The `service_role` key bypasses all row-level security. Never put it in
client code, never commit it, never paste it into a chat window.

## 4. Fill in your local env file

`.env.local` has been created for you with blank values. Open it and
paste in the three values from step 3, plus:

- `ADMIN_PASSCODE` — anything you'll remember; it gates `/admin/validate`
- `ABUSE_HASH_SALT` — a long random string. Generate one with:
  ```bash
  openssl rand -hex 32
  ```

Then restart the dev server. The demo-data banner on the homepage should
disappear — that's how you know it picked up Supabase.

## 5. Test against the real database

With `npm run dev` running:

- Search a location — **this is the one thing never tested**, since the
  sandbox this was built in couldn't reach OpenStreetMap. If autocomplete
  stays empty, open the browser console and check the `/api/search`
  response.
- Submit a report. It should now persist across server restarts.
- Confirm a report ("Oo, may baha pa"), then try confirming again — the
  second attempt should say you've already confirmed.
- Visit `/admin/validate`, sign in with your `ADMIN_PASSCODE`, and
  validate the report you just submitted.

## 6. Commit and push

```bash
git add -A
git commit -m "MayBahaBa MVP: search, reporting, community validation, Cloudflare deploy"
```

Then create an empty repo on GitHub and:

```bash
git remote add origin git@github.com:<you>/maybahaba.git
git push -u origin main
```

`.env.local`, `.dev.vars`, `node_modules/`, and `.open-next/` are all
gitignored — your keys will not be committed.

## 7. Deploy to Cloudflare

```bash
cp .dev.vars.example .dev.vars   # then fill in the same values as .env.local
npm run preview                   # runs the real Worker runtime locally
```

If preview looks right:

```bash
npx wrangler login
npm run deploy
```

Then upload the secrets — the deployed Worker does **not** read
`.env.local`:

```bash
npx wrangler secret put NEXT_PUBLIC_SUPABASE_URL
npx wrangler secret put NEXT_PUBLIC_SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put ADMIN_PASSCODE
npx wrangler secret put ABUSE_HASH_SALT
```

Redeploy once more so the Worker picks them up: `npm run deploy`.

---

## Three places env vars live

This trips people up. They are **not** shared:

| How you're running | Reads from |
|---|---|
| `npm run dev` | `.env.local` |
| `npm run preview` | `.dev.vars` |
| deployed Worker | `wrangler secret put` |

Keep all three in sync.
