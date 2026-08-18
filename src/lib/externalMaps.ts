/**
 * Deep links that open a flood location in an external map or navigation app.
 *
 * COST NOTE (spec section 30/53): these are plain URLs. No API key, no
 * quota, no billing relationship — linking to Google Maps is free even
 * though *embedding* it is not. The in-app map remains OpenStreetMap +
 * Leaflet; this is purely a hand-off so a motorist can act on a report
 * in whatever app is already on their phone.
 *
 * DELIBERATE CHOICE — these show the location rather than starting
 * turn-by-turn navigation to it. Routing a driver INTO a reported flood
 * is the opposite of what this product is for. The point is to see where
 * the water is relative to your route, then decide.
 */

export interface ExternalMapTarget {
  id: "waze" | "google" | "osm";
  label: string;
  /** Short note shown as the link's accessible description. */
  description: string;
  buildUrl: (latitude: number, longitude: number, label?: string) => string;
}

export const EXTERNAL_MAP_TARGETS: ExternalMapTarget[] = [
  {
    id: "waze",
    label: "Waze",
    description: "Buksan ang lokasyon sa Waze",
    // https://developers.google.com/waze/deeplinks
    // navigate=no shows the pin instead of immediately routing there.
    buildUrl: (lat, lng) => `https://waze.com/ul?ll=${lat}%2C${lng}&navigate=no`,
  },
  {
    id: "google",
    label: "Google Maps",
    description: "Buksan ang lokasyon sa Google Maps",
    // https://developers.google.com/maps/documentation/urls/get-started
    // Coordinates rather than a place name, so it can't resolve to the
    // wrong nearby place.
    buildUrl: (lat, lng) =>
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`,
  },
  {
    id: "osm",
    label: "OpenStreetMap",
    description: "Buksan ang lokasyon sa OpenStreetMap",
    // Fully open-source option. Opens the OSM web map with a marker.
    buildUrl: (lat, lng) =>
      `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`,
  },
];
