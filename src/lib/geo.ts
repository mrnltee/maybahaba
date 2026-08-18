/** Geospatial helpers used outside the database (mock provider, client-side previews). */

const EARTH_RADIUS_METERS = 6371000;

/** Great-circle distance between two lat/lng points, in meters (Haversine). */
export function distanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_METERS * c;
}

/** Metro Manila bounding box, used to bias geocoding results (spec section 32). */
export const METRO_MANILA_VIEWBOX = {
  // left, top, right, bottom (lon/lat)
  minLon: 120.9,
  minLat: 14.35,
  maxLon: 121.15,
  maxLat: 14.78,
};

export const METRO_MANILA_CENTER = { latitude: 14.5995, longitude: 120.9842 };

/** Human-readable distance, tuned for glanceability rather than precision. */
export function formatDistance(meters: number): string {
  if (meters < 100) return "malapit lang";
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  if (meters < 10000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters / 1000)} km`;
}
