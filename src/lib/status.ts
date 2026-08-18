import { getReportFreshness } from "./freshness";
import { getFloodDepthOption, type FloodReport, type MayBahaStatus } from "./types";

/**
 * Derives the headline "May baha ba?" status for a location.
 *
 * Critically: absence of a report is never presented as "no flooding"
 * (spec section 35). It is presented as "no recent report", which is a
 * statement about data coverage, not about the road.
 */
export function deriveStatus(topReport: FloodReport | null): MayBahaStatus {
  if (!topReport) return "NO_RECENT_REPORT";

  const freshness = getReportFreshness(topReport);
  if (freshness.level === "EXPIRED") return "UNKNOWN_STALE";

  if (topReport.status === "DENIED") return "NO_RECENT_REPORT";

  // Note: a majority of "wala na" (no longer flooded) taps deliberately
  // does NOT flip the headline status on its own. Letting anonymous taps
  // clear a flood warning would hand a griefer a way to hide real
  // hazards. The dispute count is surfaced in the UI instead, and the
  // report ages out normally.

  const depth = getFloodDepthOption(topReport.floodDepth);
  if (depth.code === "WALANG_BAHA") return "NO_FLOOD_REPORTED";
  if (depth.code === "HINDI_MADAANAN") return "ROAD_IMPASSABLE";
  if (depth.severity >= 6) return "SEVERE_FLOODING";
  return "FLOODED";
}

export const STATUS_COPY: Record<
  MayBahaStatus,
  { headline: string; sub: string; tone: "neutral" | "safe" | "warning" | "danger" }
> = {
  NO_RECENT_REPORT: {
    headline: "No Recent Report",
    sub: "Walang recent na report ng baha dito. Hindi ito nangangahulugan na walang baha — wala pa lang nag-uulat.",
    tone: "neutral",
  },
  NO_FLOOD_REPORTED: {
    headline: "Walang Baha",
    sub: "Ang pinakabagong report sa lugar na ito ay walang baha.",
    tone: "safe",
  },
  FLOODED: {
    headline: "May Baha",
    sub: "May kamakailang report ng baha sa lugar na ito.",
    tone: "warning",
  },
  SEVERE_FLOODING: {
    headline: "Malalang Baha",
    sub: "May report ng malalim na baha sa lugar na ito. Mag-ingat.",
    tone: "danger",
  },
  ROAD_IMPASSABLE: {
    headline: "Hindi Madaanan",
    sub: "Iniulat na hindi na madaanan ang kalsada dito.",
    tone: "danger",
  },
  UNKNOWN_STALE: {
    headline: "Lumang Report",
    sub: "May naunang report pero luma na ito — maaaring hindi na ito kasalukuyang kondisyon.",
    tone: "neutral",
  },
};
