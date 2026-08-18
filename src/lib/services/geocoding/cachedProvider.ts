import { supabasePublic } from "@/lib/supabaseClient";
import type { LocationResult } from "@/lib/types";
import type { GeocodingProvider } from "./types";

/**
 * Caching decorator around any GeocodingProvider.
 *
 * WHY THIS MATTERS ON CLOUDFLARE: Nominatim's usage policy allows roughly
 * one request per second per application and expects heavy caching. A
 * Worker runs in dozens of Cloudflare colos worldwide, each with its own
 * isolate, so an uncached deployment can look like distributed abuse from
 * Nominatim's side and get the whole app blocked. Caching is not a
 * performance nicety here — it is what keeps the free geocoder usable.
 *
 * Two layers:
 *  1. per-isolate in-memory LRU — absorbs repeat keystrokes cheaply
 *  2. the shared `locations` table in Postgres — survives isolate churn
 *     and is shared across every colo, so a query someone typed in Manila
 *     is already cached for the next person
 *
 * Layer 2 is skipped when Supabase isn't configured (local mock mode).
 */

const MEMORY_TTL_MS = 10 * 60 * 1000;
const MEMORY_MAX_ENTRIES = 200;
/** How long a shared (Postgres) cache entry is considered usable. */
const DB_TTL_DAYS = 30;

interface MemoryEntry {
  results: LocationResult[];
  expiresAt: number;
}

const memoryCache = new Map<string, MemoryEntry>();

function memoryGet(key: string): LocationResult[] | null {
  const hit = memoryCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  // Refresh LRU position.
  memoryCache.delete(key);
  memoryCache.set(key, hit);
  return hit.results;
}

function memorySet(key: string, results: LocationResult[]): void {
  if (memoryCache.size >= MEMORY_MAX_ENTRIES) {
    const oldest = memoryCache.keys().next().value;
    if (oldest !== undefined) memoryCache.delete(oldest);
  }
  memoryCache.set(key, { results, expiresAt: Date.now() + MEMORY_TTL_MS });
}

function normalizeKey(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

interface LocationRow {
  label: string;
  latitude: number;
  longitude: number;
  street: string | null;
  barangay: string | null;
  city: string | null;
  province: string | null;
  kind: string | null;
}

export class CachedGeocodingProvider implements GeocodingProvider {
  constructor(private readonly inner: GeocodingProvider) {}

  async search(query: string): Promise<LocationResult[]> {
    const key = normalizeKey(query);
    if (key.length < 2) return [];

    const fromMemory = memoryGet(key);
    if (fromMemory) return fromMemory;

    const fromDb = await this.readFromDb(key);
    if (fromDb && fromDb.length > 0) {
      memorySet(key, fromDb);
      return fromDb;
    }

    const results = await this.inner.search(query);
    memorySet(key, results);
    // Fire-and-forget: a cache write must never delay or fail a search.
    void this.writeToDb(key, results);
    return results;
  }

  /**
   * Reverse geocoding is not cached. It is only triggered by an explicit
   * user action ("Use My Location" or dropping a pin), so volume is low
   * and coordinates are effectively unique per call — a cache would have
   * a near-zero hit rate while adding a round trip.
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<LocationResult | null> {
    return this.inner.reverseGeocode(latitude, longitude);
  }

  private async readFromDb(key: string): Promise<LocationResult[] | null> {
    if (!supabasePublic) return null;
    try {
      const freshSince = new Date(Date.now() - DB_TTL_DAYS * 86_400_000).toISOString();
      const { data, error } = await supabasePublic
        .from("locations")
        .select("label, latitude, longitude, street, barangay, city, province, kind")
        .eq("query", key)
        .gte("created_at", freshSince)
        .limit(8);
      if (error || !data) return null;

      return (data as LocationRow[]).map((row, index) => ({
        id: `cache:${key}:${index}`,
        label: row.label,
        latitude: row.latitude,
        longitude: row.longitude,
        street: row.street,
        barangay: row.barangay,
        city: row.city,
        province: row.province,
        kind: (row.kind as LocationResult["kind"]) ?? "other",
      }));
    } catch {
      return null;
    }
  }

  private async writeToDb(key: string, results: LocationResult[]): Promise<void> {
    if (!supabasePublic || results.length === 0) return;
    try {
      // Upsert on (query, label) — see migration 0004. Repeated searches
      // for the same term refresh the row instead of appending duplicates.
      await supabasePublic.from("locations").upsert(
        results.map((r) => ({
          query: key,
          label: r.label,
          latitude: r.latitude,
          longitude: r.longitude,
          street: r.street,
          barangay: r.barangay,
          city: r.city,
          province: r.province,
          kind: r.kind,
        })),
        { onConflict: "query,label", ignoreDuplicates: false }
      );
    } catch {
      // Caching is best-effort; a failed write is not a failed search.
    }
  }
}
