"use client";

import { DemoDataBadge } from "@/components/DemoDataBadge";
import { DepthIcon } from "@/components/DepthIcon";
import { conciseLocationLabel } from "@/lib/formatLocation";
import { distanceMeters, formatDistance } from "@/lib/geo";
import { formatRelativeTime } from "@/lib/time";
import { getFloodDepthOption, type AreaSearchResult, type FloodReport } from "@/lib/types";
import { MapPinned } from "lucide-react";

/**
 * The answer for a whole city, barangay, or province.
 *
 * Deliberately NOT the single-answer card. "Quezon City" has no one
 * condition, and headlining the worst report would read as a claim about
 * the entire city — the same fabricated-certainty problem the point
 * search avoids, just at a larger scale. So this states counts, then
 * lists what was actually reported and where.
 *
 * Sorted worst-first: someone scanning a city wants the roads to avoid at
 * the top, not the most recent trivial puddle.
 */
export function AreaResultCard({
  result,
  locationLabel,
  deviceLocation = null,
  onViewOnMap,
  onSelectReport,
}: {
  result: AreaSearchResult;
  locationLabel: string;
  deviceLocation?: { latitude: number; longitude: number } | null;
  onViewOnMap: () => void;
  onSelectReport?: (report: FloodReport) => void;
}) {
  const { totalReports, impassableCount, severeCount, reports } = result;

  return (
    <section
      aria-live="polite"
      className="w-full rounded-2xl border border-(--color-border) bg-(--color-surface) p-6 sm:p-8"
    >
      <p className="flex items-start gap-1.5 text-sm text-(--color-ink-muted)">
        <MapPinned className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{locationLabel}</span>
      </p>

      {totalReports === 0 ? (
        <>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-(--color-ink)">
            Walang recent na report
          </h2>
          <p className="mt-2 text-sm text-(--color-ink-muted)">
            Walang recent na report ng baha sa buong lugar na ito. Hindi ito nangangahulugan na
            walang baha — wala pa lang nag-uulat.
          </p>
        </>
      ) : (
        <>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-(--color-ink) sm:text-4xl">
            {totalReports} {totalReports === 1 ? "report" : "reports"}
          </h2>
          {/*
            A breakdown rather than a verdict. "3 hindi madaanan" is a fact
            about specific roads; "May Baha" would be a claim about the
            whole city.
          */}
          <p className="mt-1 text-sm text-(--color-ink-muted)">
            {impassableCount > 0 && (
              <span className="font-medium text-(--color-danger)">
                {impassableCount} hindi madaanan
              </span>
            )}
            {impassableCount > 0 && severeCount > impassableCount && " · "}
            {severeCount > impassableCount && `${severeCount - impassableCount} tuhod pataas`}
            {impassableCount === 0 && severeCount === 0 && "Walang malalim na baha na naiulat."}
          </p>

          <ul className="mt-5 divide-y divide-(--color-border)">
            {reports.map((r) => {
              const depth = getFloodDepthOption(r.floodDepth);
              const dist = deviceLocation
                ? distanceMeters(deviceLocation.latitude, deviceLocation.longitude, r.latitude, r.longitude)
                : null;
              const row = (
                <>
                  <DepthIcon code={r.floodDepth} className="h-7 w-7 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-semibold text-(--color-ink)">{depth.label}</span>
                      <span className="text-xs text-(--color-ink-faint)">
                        {formatRelativeTime(r.reportedAt)}
                        {dist !== null && ` · ${formatDistance(dist)}`}
                      </span>
                    </span>
                    {/*
                      Street alone, not "Street, City": inside a city-wide
                      list the city is a given, and repeating it truncated
                      the part that actually identifies the road.
                    */}
                    <span className="block truncate text-xs text-(--color-ink-muted)">
                      {r.street ?? r.barangay ?? conciseLocationLabel(r, r.locationName)}
                    </span>
                  </span>
                  {r.isDemoData && <DemoDataBadge />}
                </>
              );

              return (
                <li key={r.id}>
                  {onSelectReport ? (
                    <button
                      type="button"
                      onClick={() => onSelectReport(r)}
                      className="flex min-h-14 w-full items-center gap-3 py-3 text-left hover:bg-(--color-paper) focus-visible:outline-3 focus-visible:outline-(--color-brand)"
                    >
                      {row}
                    </button>
                  ) : (
                    <div className="flex min-h-14 items-center gap-3 py-3">{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <button
        type="button"
        onClick={onViewOnMap}
        className="mt-6 inline-flex min-h-11 items-center rounded-full border border-(--color-border-strong) bg-(--color-paper) px-5 py-2.5 text-sm font-semibold text-(--color-ink) hover:bg-(--color-surface) focus-visible:outline-3 focus-visible:outline-(--color-brand)"
      >
        Tingnan lahat sa mapa
      </button>
    </section>
  );
}
