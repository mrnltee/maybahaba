"use client";

import { ResultCard } from "@/components/ResultCard";
import type { FloodReport, NearbySearchResult } from "@/lib/types";
import { notFound } from "next/navigation";

/**
 * Development-only visual harness for the result card.
 *
 * The card is the screen this product lives on, and it has many states
 * that are awkward to reach through the real UI (you'd need matching
 * reports in the database, at specific ages, with specific vote counts).
 * Rendering them side by side makes layout regressions — especially at
 * phone widths — obvious at a glance.
 *
 * Returns 404 in production; this is a workbench, not a feature.
 */

function minutesAgo(m: number) {
  return new Date(Date.now() - m * 60_000).toISOString();
}

function report(overrides: Partial<FloodReport> = {}): FloodReport {
  return {
    id: "preview",
    latitude: 14.6349,
    longitude: 121.0645,
    locationName: "Katipunan Avenue, Quezon City",
    street: "Katipunan Avenue",
    barangay: "Loyola Heights",
    city: "Quezon City",
    province: "Metro Manila",
    floodDepth: "TUHOD",
    roadCondition: "DIFFICULT",
    vehicleTypes: ["SEDAN"],
    reportedAt: minutesAgo(12),
    reporterName: null,
    anonymous: true,
    status: "PENDING",
    confidenceScore: 0,
    validationCount: 0,
    denyCount: 0,
    stillFloodedCount: 0,
    noLongerFloodedCount: 0,
    accurateCount: 0,
    inaccurateCount: 0,
    lastConfirmedAt: null,
    createdAt: minutesAgo(12),
    updatedAt: minutesAgo(12),
    isDemoData: true,
    ...overrides,
  };
}

function scenario(
  name: string,
  result: NearbySearchResult,
  locationLabel: string
): { name: string; result: NearbySearchResult; locationLabel: string } {
  return { name, result, locationLabel };
}

const VERBOSE_LABEL =
  "Katipunan, Aurora Boulevard, Loyola Heights, 3rd District, Quezon City, Eastern Manila District, Metro Manila, 1108, Philippines";

const SCENARIOS = [
  scenario(
    "Knee deep, low confidence, single report",
    {
      center: { latitude: 14.6349, longitude: 121.0645, label: "" },
      status: "FLOODED",
      topReport: report(),
      confidence: { level: "LOW", agreeingReportCount: 1 },
      freshness: { level: "VERY_RECENT", minutesAgo: 12, label: "Very recent" },
      nearbyReports: [report()],
    },
    VERBOSE_LABEL
  ),
  scenario(
    "Impassable, high confidence, confirmed, disputed",
    {
      center: { latitude: 14.6349, longitude: 121.0645, label: "" },
      status: "ROAD_IMPASSABLE",
      topReport: report({
        floodDepth: "HINDI_MADAANAN",
        status: "VALIDATED",
        stillFloodedCount: 6,
        noLongerFloodedCount: 2,
        inaccurateCount: 1,
        lastConfirmedAt: minutesAgo(2),
      }),
      confidence: { level: "HIGH", agreeingReportCount: 7 },
      freshness: { level: "VERY_RECENT", minutesAgo: 3, label: "Very recent" },
      nearbyReports: [report(), report({ id: "b" }), report({ id: "c" })],
    },
    VERBOSE_LABEL
  ),
  scenario(
    "No recent report (the safety-critical empty state)",
    {
      center: { latitude: 14.55, longitude: 121.02, label: "" },
      status: "NO_RECENT_REPORT",
      topReport: null,
      confidence: { level: "NONE", agreeingReportCount: 0 },
      freshness: null,
      nearbyReports: [],
    },
    "Makati Avenue, Makati"
  ),
  scenario(
    "Someone checked and there was no flooding",
    {
      center: { latitude: 14.55, longitude: 121.02, label: "" },
      status: "NO_FLOOD_REPORTED",
      topReport: report({ floodDepth: "WALANG_BAHA", isDemoData: false }),
      confidence: { level: "MEDIUM", agreeingReportCount: 2 },
      freshness: { level: "RECENT", minutesAgo: 40, label: "Recent" },
      nearbyReports: [report(), report({ id: "b" })],
    },
    "Makati Avenue, Makati"
  ),
  scenario(
    "Stale — old data must not read as current",
    {
      center: { latitude: 14.6488, longitude: 121.0509, label: "" },
      status: "UNKNOWN_STALE",
      topReport: report({ floodDepth: "BAYWANG", reportedAt: minutesAgo(600) }),
      confidence: { level: "LOW", agreeingReportCount: 1 },
      freshness: { level: "EXPIRED", minutesAgo: 600, label: "Expired" },
      nearbyReports: [report()],
    },
    "Marikina City Hall, Marikina"
  ),
];

export default function PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <h1 className="text-lg font-bold text-(--color-ink)">ResultCard states</h1>
      <p className="mt-1 text-sm text-(--color-ink-muted)">
        Dev-only harness. Resize the window to check phone widths.
      </p>
      <div className="mt-6 space-y-10">
        {SCENARIOS.map((s) => (
          <section key={s.name} data-scenario={s.name}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-(--color-ink-faint)">
              {s.name}
            </h2>
            <ResultCard result={s.result} locationLabel={s.locationLabel} onViewOnMap={() => {}} />
          </section>
        ))}
      </div>
    </main>
  );
}
