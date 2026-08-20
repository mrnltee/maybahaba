import { FLOOD_DEPTH_OPTIONS, type FloodDepthCode, type FloodDepthOption } from "./types";

/**
 * Turns a flood depth into a waterline the illustration can draw.
 *
 * Deliberately derived from `approxCm`, which FLOOD_DEPTH_OPTIONS already
 * carries, rather than a second hand-written table of heights. A separate
 * table would be a duplicate source of truth for what "Tuhod" means, and
 * the two would drift the first time someone adjusted a range.
 *
 * The scene is drawn against a fixed real-world reference height so the
 * waterline is anatomically honest: at "Tuhod" the water really does sit
 * at roughly knee height on the standing figure, which is the entire
 * point of showing a figure at all.
 */

/** Real-world height the illustration's vertical extent represents. */
export const SCENE_REFERENCE_CM = 200;

/**
 * Water height in centimetres for each depth.
 *
 * The upper bound of each range is used, not the midpoint: the label is a
 * claim about where the water reaches, and a motorist reading "Tuhod"
 * should see water at the knee rather than just below it. Under-drawing a
 * hazard is the wrong direction to round in.
 *
 * HINDI_MADAANAN has an open-ended range (100cm+). It is pinned to a
 * concrete value here purely so the scene has something to draw — the
 * component renders it as a distinct warning state, not as a measurement.
 */
export function getWaterlineCm(code: FloodDepthCode): number {
  if (code === "HUMUPA_NA") return 0;
  const option = FLOOD_DEPTH_OPTIONS.find((o) => o.code === code);
  if (!option || !option.approxCm) return 0;
  const [, upper] = option.approxCm;
  // The impassable band is open-ended. Its ceiling is MMDA's deepest
  // named level — chest deep, 45 inches — rather than a made-up number,
  // so the scene tops out somewhere real.
  if (upper === null || Number.isNaN(upper)) return 114;
  return upper;
}

/** Waterline as a 0-1 fraction of the scene's height. */
export function getWaterlineFraction(code: FloodDepthCode): number {
  return Math.min(1, getWaterlineCm(code) / SCENE_REFERENCE_CM);
}

/**
 * The ordered scale the slider steps through: shallowest first, so the
 * slider's minimum is "no flood" and dragging up raises the water.
 *
 * Note this is ascending by severity, which is the opposite of the order
 * the labels are stacked visually (deepest at the top of the column).
 * Keeping the data ascending and letting the layout reverse it means the
 * slider's value maps directly to an index without arithmetic tricks.
 */
export const DEPTH_SCALE: FloodDepthOption[] = [...FLOOD_DEPTH_OPTIONS].sort(
  (a, b) => a.severity - b.severity
);

export function getScaleIndex(code: FloodDepthCode): number {
  const i = DEPTH_SCALE.findIndex((o) => o.code === code);
  return i === -1 ? 0 : i;
}

export function getCodeAtIndex(index: number): FloodDepthCode {
  const clamped = Math.max(0, Math.min(DEPTH_SCALE.length - 1, Math.round(index)));
  return DEPTH_SCALE[clamped].code;
}

/**
 * Depths at or above MMDA's NPATV threshold (66cm / tire deep).
 * Computed once from the same approxCm the scene draws from.
 */
const NPATV_CODES: Set<FloodDepthCode> = new Set(
  FLOOD_DEPTH_OPTIONS.filter((o) => {
    const upper = o.approxCm?.[1];
    const cm = upper === null || upper === undefined || Number.isNaN(upper) ? 114 : upper;
    return cm >= 66;
  }).map((o) => o.code)
);

/**
 * Whether the scene should render as "road closed" rather than as one
 * more step up the same scale.
 *
 * This used to mean only HINDI_MADAANAN. It now covers every depth MMDA
 * classes NPATV, which starts at **66cm — thigh height, not waist**.
 * Reserving the warning for the top rung left a 66-94cm band that MMDA
 * calls impassable to every vehicle while the app said only "malalim".
 *
 * The threshold is duplicated as a literal here rather than imported from
 * mmda.ts, which would be a cycle — mmda.ts reads getWaterlineCm from
 * this file. A test asserts the two agree on every depth, so the
 * duplication cannot drift silently.
 */
export function isImpassable(code: FloodDepthCode): boolean {
  return NPATV_CODES.has(code);
}



/**
 * Human-readable water height, for the caption under the scene.
 * Returns null where a number would imply more precision than we have.
 */
export function formatWaterline(code: FloodDepthCode): string | null {
  if (code === "WALANG_BAHA" || code === "HUMUPA_NA") return null;
  // Only the top rung is open-ended. This used to key off isImpassable,
  // which was fine while that meant HINDI_MADAANAN alone — once the
  // impassable threshold moved down to 66cm it made Hita, a 70cm depth,
  // claim to be "higit 1 metro".
  if (code === "HINDI_MADAANAN") return "higit 1 metro";
  const cm = getWaterlineCm(code);
  return `mga ${cm} cm`;
}
