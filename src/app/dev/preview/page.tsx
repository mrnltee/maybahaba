"use client";

import { AreaResultCard } from "@/components/AreaResultCard";
import { ResultCard } from "@/components/ResultCard";
import type { AreaSearchResult, FloodReport, NearbySearchResult } from "@/lib/types";
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

const QC_BOUNDS = { minLat: 14.58, minLon: 120.98, maxLat: 14.78, maxLon: 121.14 };

const AREA_SCENARIOS: { name: string; result: AreaSearchResult; label: string }[] = [
  {
    name: "City with several reports",
    label: "Quezon City, Metro Manila",
    result: {
      bounds: QC_BOUNDS,
      label: "Quezon City",
      totalReports: 5,
      impassableCount: 2,
      severeCount: 3,
      reports: [
        report({ id: "a", latitude: 14.6910, longitude: 121.0740, floodDepth: "HINDI_MADAANAN", locationName: "Commonwealth Avenue, Quezon City", street: "Commonwealth Avenue", reportedAt: minutesAgo(6) }),
        report({ id: "b", latitude: 14.6740, longitude: 121.0490, floodDepth: "HINDI_MADAANAN", locationName: "Tandang Sora Avenue, Quezon City", street: "Tandang Sora Avenue", reportedAt: minutesAgo(14) }),
        report({ id: "c", latitude: 14.6349, longitude: 121.0645, floodDepth: "TUHOD", locationName: "Katipunan Avenue, Quezon City", street: "Katipunan Avenue", reportedAt: minutesAgo(22) }),
        report({ id: "d", latitude: 14.6220, longitude: 121.0310, floodDepth: "GUTTER_DEEP", locationName: "Aurora Boulevard, Quezon City", street: "Aurora Boulevard", reportedAt: minutesAgo(35) }),
        report({ id: "e", latitude: 14.6510, longitude: 121.0290, floodDepth: "WALANG_BAHA", locationName: "Quezon Avenue, Quezon City", street: "Quezon Avenue", reportedAt: minutesAgo(50), isDemoData: false }),
      ],
    },
  },
  {
    name: "City with nothing reported (must not imply safety)",
    label: "Pasig City, Metro Manila",
    result: {
      bounds: QC_BOUNDS,
      label: "Pasig City",
      totalReports: 0,
      impassableCount: 0,
      severeCount: 0,
      reports: [],
    },
  },
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
            <ResultCard
              result={s.result}
              locationLabel={s.locationLabel}
              onViewOnMap={() => {}}
              radiusMeters={300}
            />
          </section>
        ))}
      </div>

      <h1 className="mt-12 text-lg font-bold text-(--color-ink)">AreaResultCard states</h1>
      <div className="mt-4 space-y-10">
        {AREA_SCENARIOS.map((s2) => (
          <section key={s2.name} data-scenario={s2.name}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-(--color-ink-faint)">
              {s2.name}
            </h2>
            <AreaResultCard
              result={s2.result}
              locationLabel={s2.label}
              deviceLocation={{ latitude: 14.63, longitude: 121.06 }}
              onViewOnMap={() => {}}
            />
          </section>
        ))}
      </div>
    </main>
  );
}
