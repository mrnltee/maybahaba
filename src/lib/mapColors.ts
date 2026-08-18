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

export const MAP_LEGEND: { color: string; label: string }[] = [
  { color: "#1a7a4c", label: "Walang recent na report ng baha" },
  { color: "#c9a227", label: "Mababaw na baha (gutter deep)" },
  { color: "#d97a1f", label: "Katamtamang baha (bukong-bukong–binti)" },
  { color: "#c1401f", label: "Malalim na baha (tuhod pataas)" },
  { color: "#6b1414", label: "Hindi madaanan" },
];
