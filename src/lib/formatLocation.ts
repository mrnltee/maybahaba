/**
 * Turns a raw geocoder label into something a motorist can read at a glance.
 *
 * Nominatim returns the full administrative chain, e.g.
 *   "Katipunan, Aurora Boulevard, Loyola Heights, 3rd District, Quezon
 *    City, Eastern Manila District, Metro Manila, 1108, Philippines"
 *
 * That fights the product's core requirement — the answer has to be
 * comprehensible in a couple of seconds on a phone (spec section 27/45).
 * A motorist needs the street and the city; the district, postcode and
 * country are noise they already know.
 *
 * The full string is never thrown away — callers keep it as a `title`
 * attribute so the precise match is still inspectable.
 */

interface LocationParts {
  street?: string | null;
  barangay?: string | null;
  city?: string | null;
  province?: string | null;
}

/** Segments that add nothing for a local reader. */
const NOISE = [
  /^\d{4}$/, // postcode
  /^philippines$/i,
  /district$/i,
  /^metro manila$/i,
];

function isNoise(segment: string): boolean {
  const s = segment.trim();
  return s.length === 0 || NOISE.some((re) => re.test(s));
}

/**
 * Builds a short label, preferring the geocoder's structured fields and
 * falling back to trimming the raw display string.
 */
export function conciseLocationLabel(parts: LocationParts, fallback: string): string {
  const place = parts.street ?? parts.barangay ?? null;
  const area = parts.city ?? parts.province ?? null;

  if (place && area) return `${place}, ${area}`;
  if (place) return place;
  if (area) return area;

  // No structured fields — salvage the first useful segments of the raw
  // label. Keeps two, which is almost always "<place>, <city>".
  const useful = fallback
    .split(",")
    .map((s) => s.trim())
    .filter((s) => !isNoise(s));

  if (useful.length === 0) return fallback;
  return useful.slice(0, 2).join(", ");
}

/** True when shortening actually changed something worth a tooltip. */
export function wasShortened(concise: string, full: string): boolean {
  return concise.trim() !== full.trim();
}
