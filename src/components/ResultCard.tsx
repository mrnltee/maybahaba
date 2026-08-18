"use client";

import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { DemoDataBadge } from "@/components/DemoDataBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { CommunitySignals, ValidationControls } from "@/components/ValidationControls";
import { ExternalMapLinks } from "@/components/ExternalMapLinks";
import { conciseLocationLabel, wasShortened } from "@/lib/formatLocation";
import { getFloodDepthOption } from "@/lib/types";
import { formatPhTime, formatRelativeTime } from "@/lib/time";
import { STATUS_COPY } from "@/lib/status";
import type { FloodReport, NearbySearchResult } from "@/lib/types";
import { MapPinned } from "lucide-react";

export function ResultCard({
  result,
  locationLabel,
  onViewOnMap,
  onReportUpdated,
}: {
  result: NearbySearchResult;
  locationLabel: string;
  onViewOnMap: () => void;
  onReportUpdated?: (report: FloodReport) => void;
}) {
  const { topReport, status, confidence, nearbyReports } = result;
  const copy = STATUS_COPY[status];
  const depth = topReport ? getFloodDepthOption(topReport.floodDepth) : null;
  const otherReportsCount = Math.max(0, nearbyReports.length - (topReport ? 1 : 0));

  // Prefer the report's own structured address fields; fall back to the
  // searched location's raw label when there is no report yet.
  const displayLabel = topReport
    ? conciseLocationLabel(topReport, topReport.locationName)
    : conciseLocationLabel({}, locationLabel);

  return (
    <section
      aria-live="polite"
      className="w-full rounded-2xl border border-(--color-border) bg-(--color-surface) p-6 sm:p-8"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-(--color-ink-faint)">
          May Baha
        </p>
        {topReport?.isDemoData && <DemoDataBadge />}
      </div>

      <div className="mt-3">
        <StatusBadge status={status} />
      </div>

      {depth && depth.code !== "WALANG_BAHA" && (
        <p className="mt-4 text-3xl font-bold tracking-tight text-(--color-ink) sm:text-4xl">
          {depth.label}
        </p>
      )}
      {depth && (
        <p className="mt-1 text-sm text-(--color-ink-muted)">{depth.description}</p>
      )}

      <p className="mt-4 text-sm text-(--color-ink-muted)">{copy.sub}</p>

      {topReport && (
        <>
          <p className="mt-4 text-sm font-medium text-(--color-ink)">
            Reported {formatRelativeTime(topReport.reportedAt)}
            <span className="ml-2 font-normal text-(--color-ink-faint)">
              ({formatPhTime(topReport.reportedAt)})
            </span>
          </p>
          {topReport.lastConfirmedAt && (
            <p className="mt-0.5 text-sm text-(--color-ink-muted)">
              Huling kumpirmado {formatRelativeTime(topReport.lastConfirmedAt)}
            </p>
          )}
        </>
      )}

      <div className="mt-2 flex items-start gap-2 text-sm text-(--color-ink-muted)">
        <MapPinned className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {/* Short label for glanceability; full geocoder string kept as a
            tooltip so the exact match is still verifiable. */}
        <span title={wasShortened(displayLabel, locationLabel) ? locationLabel : undefined}>
          {displayLabel}
        </span>
      </div>

      {confidence.level !== "NONE" && (
        <div className="mt-3">
          <ConfidenceBadge confidence={confidence} />
        </div>
      )}

      {otherReportsCount > 0 && (
        <p className="mt-1 text-sm text-(--color-ink-faint)">
          {otherReportsCount} pang report sa loob ng 300m
        </p>
      )}

      {topReport && (
        <div className="mt-1">
          <CommunitySignals report={topReport} />
        </div>
      )}

      <button
        type="button"
        onClick={onViewOnMap}
        className="mt-6 inline-flex items-center rounded-full border border-(--color-border) bg-(--color-paper) px-5 py-2.5 text-sm font-semibold text-(--color-ink) transition-colors hover:bg-(--color-surface) focus-visible:outline-3 focus-visible:outline-(--color-brand)"
      >
        View on Map
      </button>

      {topReport && (
        <div className="mt-4">
          <ExternalMapLinks
            latitude={topReport.latitude}
            longitude={topReport.longitude}
            label={topReport.locationName}
          />
        </div>
      )}

      {topReport && (
        <div className="mt-6 border-t border-(--color-border) pt-4">
          <ValidationControls report={topReport} onVoted={onReportUpdated} />
        </div>
      )}
    </section>
  );
}
