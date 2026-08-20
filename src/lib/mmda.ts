import { getWaterlineCm } from "./floodScale";
import type { FloodDepthCode, RoadConditionCode, VehicleTypeCode } from "./types";

/**
 * MMDA's official flood-gauge passability bands, mapped onto MayBahaBa's
 * Filipino depth scale.
 *
 * ---------------------------------------------------------------------
 * The source
 * ---------------------------------------------------------------------
 * MMDA's 2024 flood gauge sorts depths into three acronym bands:
 *
 *   PATV   Passable to All Types of Vehicles
 *          gutter deep 8in (~20cm), half-knee deep 10in (~25cm)
 *   NPLV   Not Passable to Light Vehicles
 *          half tire 13in (~33cm), knee deep 19in (~48cm)
 *   NPATV  Not Passable to All Types of Vehicles
 *          tire deep 26in (~66cm), waist deep 37in (~94cm),
 *          chest deep 45in (~114cm)
 *
 * ---------------------------------------------------------------------
 * Why this is derived rather than hand-assigned per depth
 * ---------------------------------------------------------------------
 * Our labels are body parts and MMDA's are vehicle parts, so the two
 * scales do not line up level-for-level. What they share is centimetres.
 * Classifying by depth means the mapping stays correct if a range in
 * `types.ts` is ever adjusted, instead of quietly going stale.
 *
 * It also surfaces a fact worth stating plainly: **NPATV begins at 66cm,
 * which is thigh height, not waist**. Treating waist as the impassable
 * threshold would leave a 66-94cm band where MMDA says nothing can pass
 * and the app would not say so.
 */

export type MmdaBand = "PATV" | "NPLV" | "NPATV";

/** Top of MMDA's PATV band — half-knee deep, 10 inches. */
export const PATV_MAX_CM = 25;
/** Bottom of MMDA's NPATV band — tire deep, 26 inches. */
export const NPATV_MIN_CM = 66;

export interface MmdaAssessment {
  band: MmdaBand;
  /** The acronym, shown as a compact badge. */
  code: MmdaBand;
  /** Filipino summary of what the band means for a driver. */
  label: string;
  /** English expansion, for the accessible name and the tooltip. */
  expansion: string;
}

const BANDS: Record<MmdaBand, Omit<MmdaAssessment, "band">> = {
  PATV: {
    code: "PATV",
    label: "Madaanan ng lahat ng sasakyan",
    expansion: "Passable to all types of vehicles",
  },
  NPLV: {
    code: "NPLV",
    label: "Hindi madaanan ng light vehicles",
    expansion: "Not passable to light vehicles",
  },
  NPATV: {
    code: "NPATV",
    label: "Hindi madaanan ng kahit anong sasakyan",
    expansion: "Not passable to all types of vehicles",
  },
};

/**
 * The band for a depth, or null where there is no flood to assess.
 *
 * Boundaries round toward caution. MMDA leaves a gap between 25cm
 * (still passable) and 33cm (no longer passable to light vehicles);
 * anything in that gap is treated as the stricter band, because
 * over-warning costs a detour and under-warning costs a stalled car.
 */
export function getMmdaAssessment(code: FloodDepthCode): MmdaAssessment | null {
  if (code === "WALANG_BAHA" || code === "HUMUPA_NA") return null;

  const cm = getWaterlineCm(code);
  if (cm <= 0) return null;

  const band: MmdaBand = cm >= NPATV_MIN_CM ? "NPATV" : cm > PATV_MAX_CM ? "NPLV" : "PATV";
  return { band, ...BANDS[band] };
}

/**
 * Whether MMDA classes this depth as impassable to every vehicle.
 * This — not "is it waist deep" — is what drives the road-closed warning.
 */
export function isNoVehiclePassable(code: FloodDepthCode): boolean {
  return getMmdaAssessment(code)?.band === "NPATV";
}

/**
 * Whether asking "which vehicles were affected?" would actually tell us
 * anything.
 *
 * Only in the NPLV band. Above it nothing passes, so the answer is
 * predetermined; below it everything passes, so the answer is equally
 * uninformative. NPLV is the one range where passability genuinely
 * depends on what you are driving — which is exactly what "not passable
 * to LIGHT vehicles" means.
 */
export function shouldAskVehicleTypes(code: FloodDepthCode | null): boolean {
  if (!code) return false;
  return getMmdaAssessment(code)?.band === "NPLV";
}

/**
 * Road condition, derived from the depth rather than asked separately.
 *
 * The report form used to carry a "hindi madaanan ang kalsada" tickbox
 * alongside the depth picker. Once the MMDA band is computed from depth,
 * that tickbox becomes a SECOND source of truth about the same fact — and
 * the two can disagree. A reporter could tick "hindi madaanan" at
 * gutter-deep, or leave it blank at waist-deep, and the record would then
 * contain a passability claim that contradicts the one the app displays.
 *
 * Deriving it keeps the moderator table and the CSV export populated for
 * new reports without asking a question the depth already answers.
 * Existing rows keep whatever finer-grained value they were filed with.
 */
export function getDerivedRoadCondition(
  code: FloodDepthCode | null
): RoadConditionCode | null {
  if (!code) return null;
  const band = getMmdaAssessment(code)?.band;
  if (!band) return code === "WALANG_BAHA" ? "PASSABLE" : null;
  if (band === "NPATV") return "NOT_PASSABLE";
  if (band === "NPLV") return "DIFFICULT";
  return "PASSABLE";
}

/**
 * The vehicles a depth affects, used to pre-fill the report form.
 *
 *  PATV   nothing is stopped, so nothing is affected.
 *  NPLV   the light vehicles are — motorcycles and sedans. That IS what
 *         "not passable to light vehicles" names, so it is a defensible
 *         default rather than a guess. The reporter can still untick
 *         either, because a specific street may behave differently.
 *  NPATV  every type, by definition of the band. Nothing to ask.
 *
 * Returning a default is what lets the form stop asking at NPATV without
 * losing the data: the answer is entailed by the depth, so recording it
 * is honest rather than invented.
 */
export function getDefaultVehicleTypes(code: FloodDepthCode | null): VehicleTypeCode[] {
  if (!code) return [];
  const band = getMmdaAssessment(code)?.band;
  if (band === "NPATV") {
    return ["MOTORCYCLE", "SEDAN", "SUV", "TRUCK", "JEEPNEY", "OTHER"];
  }
  if (band === "NPLV") return ["MOTORCYCLE", "SEDAN"];
  return [];
}
