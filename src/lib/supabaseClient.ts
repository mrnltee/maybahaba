import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Two clients, two trust levels:
 *  - `supabasePublic` uses the anon key and is subject to Row Level
 *    Security. Used for public reads and anonymous report submission.
 *  - `supabaseAdmin` uses the service role key (server-only, never sent
 *    to the browser) and bypasses RLS. Used only from the /admin
 *    validation API routes.
 *
 * Both are `null` when Supabase env vars are not configured, in which
 * case `services/reports/index.ts` falls back to the mock provider.
 */

/**
 * Supabase is migrating key naming. Both generations are accepted here:
 *
 *   new (preferred)   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  sb_publishable_…
 *                     SUPABASE_SECRET_KEY                   sb_secret_…
 *   legacy            NEXT_PUBLIC_SUPABASE_ANON_KEY         a JWT
 *                     SUPABASE_SERVICE_ROLE_KEY             a JWT
 *
 * Legacy keys still work but Supabase has announced deprecation at the
 * end of 2026, so new projects should use the publishable/secret pair.
 * Both are passed to createClient in the same position — supabase-js
 * sends the value as both `apikey` and `Authorization`, which is the
 * usage the new keys permit.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabasePublic: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, { auth: { persistSession: false } })
  : null;

export const supabaseAdmin: SupabaseClient | null =
  isSupabaseConfigured && serviceRoleKey
    ? createClient(url!, serviceRoleKey, { auth: { persistSession: false } })
    : null;
