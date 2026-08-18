import type { FloodDepthCode } from "./types";

/**
 * Marker/legend colors for the interactive flood map (spec section 19).
 * Never the only signal — every marker is paired with a text label in its
 * popup, and the legend spells out each color in words.
 */
export const DEPTH_MAP_COLOR: Record<FloodDepthCode, string> = {
  WALANG_BAHA: "#1a7a4c", // green — no recent flood reported here
  GUTTER_DEEP: "#c9a227", // yellow — minor
  BUKONG_BUKONG: "#d97a1f", // orange — moderate
  BINTI: "#d97a1f",
  TUHOD: "#c1401f", // red — severe
  HITA: "#c1401f",
  BAYWANG: "#c1401f",
  HINDI_MADAANAN: "#6b1414", // dark red — impassable
};

/**
 * Colour for a report the community has disputed.
 *
 * Note that outright DENIED reports never reach the public map — the
 * queries exclude them. What this covers is the in-between state: a
 * report that has been flagged, or that more people have called wrong
 * than right. Painting those in their depth colour would assert a
 * condition the community itself doubts, so they go grey: visible,
 * because suppressing a possible hazard is worse, but visibly unverified.
 */
export const DISPUTED_MAP_COLOR = "#8b9096";

/** Whether a report should render as disputed rather than by depth. */
export function isDisputed(report: {
  status: string;
  inaccurateCount: number;
  accurateCount: number;
}): boolean {
  return report.status === "FLAGGED" || report.inaccurateCount > report.accurateCount;
}

export const MAP_LEGEND: { color: string; label: string }[] = [
  { color: "#1a7a4c", label: "Walang recent na report ng baha" },
  { color: "#c9a227", label: "Mababaw na baha (gutter deep)" },
  { color: "#d97a1f", label: "Katamtamang baha (bukong-bukong–binti)" },
  { color: "#c1401f", label: "Malalim na baha (tuhod pataas)" },
  { color: "#6b1414", label: "Hindi madaanan" },
  { color: DISPUTED_MAP_COLOR, label: "Di-beripikado / may duda" },
];
