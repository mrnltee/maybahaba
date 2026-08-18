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

/**
 * The single screen this product lives or dies on.
 *
 * Structured in four tiers, because the brief's success criterion is that
 * a motorist can answer "may baha ba?" in seconds (spec section 27/55):
 *
 *   1. ANSWER    status + depth + how long ago — readable at a glance
 *   2. CONTEXT   where, and how much to trust it
 *   3. ACT       view on map, hand off to a navigation app
 *   4. CONTRIBUTE  confirm the report for the next person
 *
 * Everything the previous version showed is still here; it is re-ranked,
 * not removed. Explanatory prose and the absolute timestamp moved below
 * the fold of attention (or into a tooltip) so they stop competing with
 * the answer itself.
 */
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

  const isStale = status === "UNKNOWN_STALE";

  /**
   * The depth gets hero treatment only when it describes conditions we
   * believe are CURRENT. "Baywang" set in 48px is a strong claim; making
   * it that loud on a six-hour-old report would lend stale data the same
   * authority as fresh data, which is exactly the confusion spec section
   * 35 warns against. Stale reports still show the depth — just quietly,
   * with the badge carrying the "this is old" signal.
   */
  const heroDepth = Boolean(depth && depth.code !== "WALANG_BAHA" && !isStale);

  /**
   * With no report, the status badge already says "No Recent Report" —
   * repeating it as a headline was pure duplication. The heading stays in
   * the DOM for document structure, just visually hidden.
   */
  const headingIsVisual = Boolean(topReport);

  return (
    <section
      aria-live="polite"
      className="w-full rounded-2xl border border-(--color-border) bg-(--color-surface) p-6 sm:p-8"
    >
      {/* ---- Tier 2 (top): where, so the answer below has a subject ---- */}
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-start gap-1.5 text-sm text-(--color-ink-muted)">
          <MapPinned className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span title={wasShortened(displayLabel, locationLabel) ? locationLabel : undefined}>
            {displayLabel}
          </span>
        </p>
        {topReport?.isDemoData && <DemoDataBadge />}
      </div>

      {/* ---- Tier 1: the answer ---- */}
      <div className="mt-4">
        <StatusBadge status={status} />
      </div>

      <h2
        className={
          !headingIsVisual
            ? "sr-only"
            : heroDepth
              ? "mt-3 text-4xl font-bold tracking-tight text-(--color-ink) sm:text-5xl"
              : isStale && depth
                ? "mt-3 text-xl font-semibold text-(--color-ink-muted)"
                : "mt-3 text-2xl font-bold tracking-tight text-(--color-ink)"
        }
      >
        {depth && depth.code !== "WALANG_BAHA" ? depth.label : copy.headline}
      </h2>

      {topReport && (
        <p className="mt-2 text-base font-medium text-(--color-ink)">
          Reported {formatRelativeTime(topReport.reportedAt)}
          {/* Absolute time as real text for assistive tech — a title
              attribute is not reliably announced and is unreachable by
              keyboard. Visually hidden to keep the glance-read clean. */}
          <span className="sr-only"> ({formatPhTime(topReport.reportedAt)})</span>
          {topReport.lastConfirmedAt && (
            <span className="font-normal text-(--color-ink-muted)">
              {" · kumpirmado "}
              {formatRelativeTime(topReport.lastConfirmedAt)}
            </span>
          )}
        </p>
      )}

      {/* ---- Tier 2: trust signals, on one line instead of three ---- */}
      {(confidence.level !== "NONE" || otherReportsCount > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <ConfidenceBadge confidence={confidence} />
          {/* No leading separator: at phone widths this wraps to its own
              line, and a stranded "·" reads as a typo. The flex gap does
              the separating instead. */}
          {otherReportsCount > 0 && (
            <span className="text-(--color-ink-faint)">
              {otherReportsCount} pang report sa loob ng 300m
            </span>
          )}
        </div>
      )}

      {topReport && <CommunitySignals report={topReport} />}

      {/* ---- Tier 3: the explanation, deliberately quieter ---- */}
      <div className="mt-4 space-y-1 border-l-2 border-(--color-border) pl-3">
        {depth && <p className="text-sm text-(--color-ink-muted)">{depth.description}</p>}
        <p className="text-sm text-(--color-ink-muted)">{copy.sub}</p>
      </div>

      {/* ---- Tier 3: act on it ---- */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onViewOnMap}
          className="inline-flex items-center rounded-full border border-(--color-border-strong) bg-(--color-paper) px-5 py-2.5 text-sm font-semibold text-(--color-ink) transition-colors hover:bg-(--color-surface) focus-visible:outline-3 focus-visible:outline-(--color-brand)"
        >
          View on Map
        </button>
        {topReport && (
          <ExternalMapLinks
            latitude={topReport.latitude}
            longitude={topReport.longitude}
            label={topReport.locationName}
            inline
          />
        )}
      </div>

      {/* ---- Tier 4: contribute, clearly separated from reading ---- */}
      {topReport && (
        <div className="mt-6 border-t border-(--color-border) pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-(--color-ink-faint)">
            Tulungan ang susunod
          </p>
          <ValidationControls report={topReport} onVoted={onReportUpdated} />
        </div>
      )}
    </section>
  );
}
