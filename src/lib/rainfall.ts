import { z } from "zod";

/**
 * Rainfall context — and a careful statement of what it is NOT.
 *
 * MayBahaBa's founding rule is that the app never claims something it
 * cannot verify. Rainfall is the easiest place in the whole product to
 * break that rule, so the boundaries are worth writing down:
 *
 *  1. This is NOT a flood prediction. Heavy rain does not mean the road
 *     ahead is flooded, and zero rain does not mean it is clear — Metro
 *     Manila floods from river swell, high tide, dam releases and
 *     blocked drainage hours after the rain stops. Nothing here may be
 *     rendered in a way that implies causation.
 *
 *  2. This is NOT a PAGASA advisory. PAGASA is the only body that can
 *     issue a Heavy Rainfall Warning (the RED / ORANGE / YELLOW levels),
 *     and we must never colour our own number to look like one. We link
 *     to their page instead.
 *
 *  3. This is NOT a measurement. Open-Meteo returns output from global
 *     weather models, not a reading from a rain gauge on that street.
 *     The UI says "tantiya" (estimate) for that reason.
 *
 * What it is: a rough sense of whether it is raining in the area right
 * now, to sit beside crowd-sourced reports as context.
 */

/** Open-Meteo, free tier: no API key, CC-BY 4.0, attribution required. */
const OPEN_METEO_ENDPOINT = "https://api.open-meteo.com/v1/forecast";

/** Where we send people for the authoritative warning. */
export const PAGASA_NCR_FORECAST_URL =
  "https://www.pagasa.dost.gov.ph/regional-forecast/ncrprsd";

/**
 * Validated defensively rather than cast. This is a third-party
 * response we do not control; if Open-Meteo changes shape, we want a
 * clean "walang datos" rather than `undefined.toFixed()` crashing a
 * page whose entire job is telling people whether a road is safe.
 */
const openMeteoSchema = z.object({
  current: z.object({
    time: z.string(),
    precipitation: z.number().optional(),
    rain: z.number().optional(),
    showers: z.number().optional(),
    weather_code: z.number().optional(),
  }),
});

export type RainfallBandCode = "WALANG_ULAN" | "MAHINA" | "KATAMTAMAN" | "MALAKAS" | "SOBRANG_LAKAS";

export interface RainfallBand {
  code: RainfallBandCode;
  /** Filipino label shown to the user. */
  label: string;
  /** Plain-language gloss; never phrased as a flood consequence. */
  detail: string;
}

/**
 * Millimetres in the last hour → a band.
 *
 * The thresholds follow the conventional meteorological description of
 * rainfall intensity (light / moderate / heavy / intense), NOT PAGASA's
 * warning levels. They deliberately do not map onto yellow/orange/red,
 * because borrowing that scale would imply we are issuing a warning we
 * have no authority to issue.
 */
export function getRainfallBand(mmPerHour: number): RainfallBand {
  if (mmPerHour < 0.1) {
    return {
      code: "WALANG_ULAN",
      label: "Walang ulan ngayon",
      detail: "Walang naitalang ulan sa lugar na ito sa nakaraang oras.",
    };
  }
  if (mmPerHour < 2.5) {
    return { code: "MAHINA", label: "Mahinang ulan", detail: "Ambon hanggang mahinang ulan." };
  }
  if (mmPerHour < 7.5) {
    return {
      code: "KATAMTAMAN",
      label: "Katamtamang ulan",
      detail: "Tuloy-tuloy na ulan sa lugar na ito.",
    };
  }
  if (mmPerHour < 15) {
    return { code: "MALAKAS", label: "Malakas na ulan", detail: "Malakas na buhos ng ulan." };
  }
  return {
    code: "SOBRANG_LAKAS",
    label: "Sobrang lakas ng ulan",
    detail: "Napakalakas na buhos ng ulan sa lugar na ito.",
  };
}

export interface RainfallReading {
  /** Millimetres in the last hour, as modelled. */
  mmLastHour: number;
  band: RainfallBand;
  /** Model timestamp, ISO 8601. */
  observedAt: string;
}

/**
 * Coordinates are rounded to ~1.1 km before they reach Open-Meteo.
 *
 * Two reasons, and both matter. It collapses the near-infinite set of
 * GPS coordinates onto a small grid so the cache actually hits — the
 * free tier allows 10,000 calls/day and a Worker runs in many colos, so
 * an uncached call per visitor would burn that fast. And it means we
 * never transmit a user's precise location to a third party, which is
 * the same reasoning the spec applies to report coordinates.
 */
export function quantiseCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

export class RainfallUnavailableError extends Error {}

/**
 * Fetches current rainfall for a point. Throws RainfallUnavailableError
 * on any failure — callers are expected to degrade to showing nothing
 * rather than blocking the page, because rainfall is context and the
 * flood reports are the product.
 */
export async function fetchRainfall(
  latitude: number,
  longitude: number,
  fetchImpl: typeof fetch = fetch
): Promise<RainfallReading> {
  const lat = quantiseCoordinate(latitude);
  const lon = quantiseCoordinate(longitude);

  const url =
    `${OPEN_METEO_ENDPOINT}?latitude=${lat}&longitude=${lon}` +
    `&current=precipitation,rain,showers,weather_code&timezone=Asia%2FManila&forecast_days=1`;

  let res: Response;
  try {
    res = await fetchImpl(url, {
      // Cloudflare edge-caches the upstream response for 10 minutes.
      // Open-Meteo updates roughly every 15 min, so this costs no
      // freshness and keeps us far inside the free tier.
      cf: { cacheTtl: 600, cacheEverything: true },
      signal: AbortSignal.timeout(5000),
    } as RequestInit);
  } catch (cause) {
    throw new RainfallUnavailableError("Rainfall request failed", { cause });
  }

  if (!res.ok) {
    throw new RainfallUnavailableError(`Rainfall upstream returned ${res.status}`);
  }

  const parsed = openMeteoSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) {
    throw new RainfallUnavailableError("Rainfall response failed validation");
  }

  const { current } = parsed.data;

  // `precipitation` is the total (rain + showers + snow). Prefer it, but
  // fall back to summing the components if the field is ever absent —
  // and treat "no usable number" as unavailable rather than as zero,
  // because reporting "walang ulan" during a downpour is exactly the
  // kind of false confidence this app exists to avoid.
  const total =
    current.precipitation ??
    (current.rain !== undefined || current.showers !== undefined
      ? (current.rain ?? 0) + (current.showers ?? 0)
      : undefined);

  if (total === undefined || !Number.isFinite(total) || total < 0) {
    throw new RainfallUnavailableError("Rainfall response had no usable value");
  }

  return {
    mmLastHour: total,
    band: getRainfallBand(total),
    observedAt: current.time,
  };
}
