import { CachedGeocodingProvider } from "./cachedProvider";
import { NominatimProvider } from "./nominatimProvider";
import type { GeocodingProvider } from "./types";

export type { GeocodingProvider } from "./types";
export { GeocodingError } from "./types";

/**
 * Provider selection point. Today only the free OSM/Nominatim provider is
 * implemented. A future `GOOGLE` option would live here behind the same
 * interface — see README "Map & geocoding" for the cost tradeoffs.
 *
 * Always wrapped in the caching decorator: Nominatim's usage policy
 * assumes heavy caching, and a globally distributed deployment would
 * otherwise issue far too many requests. See cachedProvider.ts.
 */
function createGeocodingProvider(): GeocodingProvider {
  return new CachedGeocodingProvider(new NominatimProvider());
}

export const geocodingProvider = createGeocodingProvider();
