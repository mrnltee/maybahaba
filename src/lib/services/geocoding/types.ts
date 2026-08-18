import type { LocationResult } from "@/lib/types";

/**
 * Abstraction boundary for geocoding/place search (spec section 31).
 * Swapping providers (OSM Nominatim → Google Places, etc.) means writing
 * a new class here — nothing else in the app should import a provider
 * directly.
 */
export interface GeocodingProvider {
  /** Free-text search with autocomplete-style fuzzy matching, biased to Metro Manila. */
  search(query: string): Promise<LocationResult[]>;
  /** Reverse-geocode a pinned/current-location point into a labeled address. */
  reverseGeocode(latitude: number, longitude: number): Promise<LocationResult | null>;
}

export class GeocodingError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "GeocodingError";
  }
}
