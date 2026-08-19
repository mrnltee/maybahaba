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
  /**
   * jsonv2's canonical "what kind of place is this". For an
   * administrative boundary this holds "city" / "state" / "suburb",
   * where `type` only says "administrative" — which is why classifying on
   * `type` alone silently mislabelled every city in the country.
   */
  addresstype?: string;
  /** Nominatim's granularity rank: lower = broader. City ~16, state ~8. */
  place_rank?: number;
  address?: NominatimAddress;
  error?: string;
}

/**
 * Maps a Nominatim result onto our own place taxonomy.
 *
 * The subtlety that caused a real bug: most Philippine cities, provinces
 * and barangays are OSM *relations* tagged `class=boundary,
 * type=administrative`. Classifying on `type` alone sent every one of
 * them to "other", so `isAreaSearch()` said false and a search for
 * "Quezon City" answered with a 300 m circle around the city centroid —
 * reporting "walang recent na report" for a city that might have had
 * reports two kilometres away. That is the exact false reassurance this
 * product exists to avoid.
 *
 * `addresstype` is checked first because in jsonv2 it carries the actual
 * administrative level. `place_rank` is the backstop for the case where
 * `addresstype` is absent or unfamiliar.
 */
function classifyKind(raw: {
  type: string;
  class: string;
  addresstype?: string;
  place_rank?: number;
}): LocationResult["kind"] {
  const { type, class: cls, addresstype, place_rank } = raw;

  // Whichever of the two fields is populated, the vocabulary is the same.
  const level = addresstype ?? type;

  if (level === "road" || level === "street" || level === "highway") return "street";
  if (level === "house" || level === "house_number" || cls === "building") return "address";
  if (
    level === "suburb" ||
    level === "neighbourhood" ||
    level === "quarter" ||
    level === "village" ||
    level === "barangay"
  ) {
    return "barangay";
  }
  if (level === "city" || level === "town" || level === "municipality") return "city";
  if (
    level === "state" ||
    level === "province" ||
    level === "region" ||
    level === "county"
  ) {
    return "province";
  }
  if (cls === "tourism" || cls === "amenity" || cls === "shop") return "landmark";

  // Still an administrative boundary but an unfamiliar label — fall back
  // on Nominatim's own granularity rank rather than giving up and
  // returning "other", which would suppress the area search.
  if (cls === "boundary" && typeof place_rank === "number") {
    if (place_rank <= 12) return "province";
    if (place_rank <= 17) return "city";
    return "barangay";
  }

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
    kind: classifyKind(raw),
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

/**
 * Exported for tests only. The classifier caused a production bug that
 * misreported a whole city as having no flood reports, so it is worth
 * pinning directly rather than only through the provider's fetch path.
 */
export const classifyKindForTest = classifyKind;
