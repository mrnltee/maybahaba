import { METRO_MANILA_VIEWBOX } from "@/lib/geo";
import type { LocationResult } from "@/lib/types";
import { GeocodingError, type GeocodingProvider } from "./types";

/**
 * FREE / OPEN SOURCE — OpenStreetMap Nominatim.
 *
 * No API key required. Subject to Nominatim's usage policy (max ~1
 * request/second, must set a descriptive User-Agent, results cached where
 * possible). This is the default and preferred provider per the
 * project's zero-cost principle (spec section 18, 30).
 *
 * Docs: https://nominatim.org/release-docs/latest/api/Search/
 */
const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const USER_AGENT = "MayBahaBa/0.1 (community flood report app; contact: set-in-env)";

export class NominatimProvider implements GeocodingProvider {
  async search(query: string): Promise<LocationResult[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    const params = new URLSearchParams({
      q: trimmed,
      format: "jsonv2",
      addressdetails: "1",
      countrycodes: "ph",
      viewbox: `${METRO_MANILA_VIEWBOX.minLon},${METRO_MANILA_VIEWBOX.maxLat},${METRO_MANILA_VIEWBOX.maxLon},${METRO_MANILA_VIEWBOX.minLat}`,
      bounded: "0", // bias, don't hard-restrict — users may search outside Metro Manila
      limit: "8",
    });

    let res: Response;
    try {
      res = await fetch(`${NOMINATIM_BASE_URL}/search?${params.toString()}`, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        // Nominatim results for a given query are effectively static; cache briefly.
        next: { revalidate: 300 },
      });
    } catch (err) {
      throw new GeocodingError("Hindi available ang map service ngayon.", err);
    }

    if (!res.ok) {
      throw new GeocodingError(`Nominatim search failed with status ${res.status}`);
    }

    const raw = (await res.json()) as NominatimResult[];
    return raw.map(toLocationResult).sort(byMetroManilaRelevance);
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<LocationResult | null> {
    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      format: "jsonv2",
      addressdetails: "1",
    });

    let res: Response;
    try {
      res = await fetch(`${NOMINATIM_BASE_URL}/reverse?${params.toString()}`, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      });
    } catch (err) {
      throw new GeocodingError("Hindi available ang map service ngayon.", err);
    }

    if (!res.ok) return null;
    const raw = (await res.json()) as NominatimResult;
    if (!raw || raw.error) return null;
    return toLocationResult(raw);
  }
}

interface NominatimAddress {
  road?: string;
  suburb?: string;
  village?: string;
  neighbourhood?: string;
  city_district?: string;
  city?: string;
  town?: string;
  municipality?: string;
  county?: string;
  state?: string;
  province?: string;
  region?: string;
}

interface NominatimResult {
  place_id: number;
  /** [minLat, maxLat, minLon, maxLon] as strings. */
  boundingbox?: [string, string, string, string];
  lat: string;
  lon: string;
  display_name: string;
  class: string;
  type: string;
  address?: NominatimAddress;
  error?: string;
}

function classifyKind(type: string, cls: string): LocationResult["kind"] {
  if (type === "road" || type === "street" || type === "highway") return "street";
  if (type === "house" || cls === "building") return "address";
  if (type === "suburb" || type === "neighbourhood" || type === "quarter") return "barangay";
  if (type === "city" || type === "town" || type === "municipality") return "city";
  if (type === "state" || type === "province" || type === "region") return "province";
  if (cls === "tourism" || cls === "amenity" || cls === "shop") return "landmark";
  return "other";
}

function toLocationResult(raw: NominatimResult): LocationResult {
  const a = raw.address ?? {};
  const barangay = a.suburb ?? a.neighbourhood ?? a.village ?? a.city_district ?? null;
  const city = a.city ?? a.town ?? a.municipality ?? null;
  const province = a.province ?? a.county ?? a.state ?? a.region ?? null;

  return {
    id: `nominatim:${raw.place_id}`,
    label: raw.display_name,
    latitude: parseFloat(raw.lat),
    longitude: parseFloat(raw.lon),
    street: a.road ?? null,
    barangay,
    city,
    province,
    kind: classifyKind(raw.type, raw.class),
    boundingBox: raw.boundingbox
      ? {
          minLat: parseFloat(raw.boundingbox[0]),
          maxLat: parseFloat(raw.boundingbox[1]),
          minLon: parseFloat(raw.boundingbox[2]),
          maxLon: parseFloat(raw.boundingbox[3]),
        }
      : null,
  };
}

function byMetroManilaRelevance(a: LocationResult, b: LocationResult): number {
  const metroCities = [
    "quezon city",
    "manila",
    "makati",
    "pasig",
    "taguig",
    "mandaluyong",
    "marikina",
    "pasay",
    "paranaque",
    "parañaque",
    "las pinas",
    "las piñas",
    "muntinlupa",
    "caloocan",
    "malabon",
    "navotas",
    "valenzuela",
    "san juan",
    "pateros",
  ];
  const score = (r: LocationResult) => {
    const city = (r.city ?? "").toLowerCase();
    const inMetro = metroCities.some((c) => city.includes(c));
    const kindBoost = r.kind === "street" ? 2 : r.kind === "address" ? 1 : 0;
    return (inMetro ? 10 : 0) + kindBoost;
  };
  return score(b) - score(a);
}
