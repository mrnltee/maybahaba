"use client";

import { AdminSignIn } from "@/components/AdminSignIn";
import { MapViewLoader } from "@/components/MapViewLoader";
import { getFloodDepthOption, type FloodReport, type ValidationAction } from "@/lib/types";
import { formatPhTime, formatRelativeTime } from "@/lib/time";
import { useEffect, useState } from "react";

type SortMode = "newest" | "nearest" | "flagged" | "high_priority";

export default function ValidateReportsPage() {
  const [authed, setAuthed] = useState<boolean | null>(null); // null = unknown until first fetch attempt

  const [sort, setSort] = useState<SortMode>("newest");
  const [reports, setReports] = useState<FloodReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actingOnId, setActingOnId] = useState<string | null>(null);

  async function loadReports() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/reports/pending?sort=${sort}`);
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.error ?? "Failed to load reports.");
        return;
      }
      setAuthed(true);
      setReports(data.reports);
    } catch {
      setLoadError("Mukhang offline ka. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  async function handleAction(reportId: string, action: ValidationAction) {
    setActingOnId(reportId);
    try {
      const res = await fetch(`/api/reports/${reportId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setReports((prev) => prev.filter((r) => r.id !== reportId));
      }
    } finally {
      setActingOnId(null);
    }
  }

  if (authed === false) {
    return <AdminSignIn onSignedIn={loadReports} />;
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-(--color-ink)">Reports to Validate</h1>
      <p className="mt-1 text-sm text-(--color-ink-muted)">
        Moderator view — hindi ito nakikita ng public.
      </p>

      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Sort reports">
        {(
          [
            { value: "newest", label: "Newest" },
            { value: "flagged", label: "Flagged" },
            { value: "high_priority", label: "High priority" },
          ] as { value: SortMode; label: string }[]
        ).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSort(opt.value)}
            aria-pressed={sort === opt.value}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
              sort === opt.value
                ? "border-(--color-brand) bg-(--color-brand) text-(--color-brand-ink)"
                : "border-(--color-border) bg-(--color-surface) text-(--color-ink) hover:bg-(--color-paper)"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading && <p className="mt-8 text-sm text-(--color-ink-faint)">Naglo-load…</p>}
      {loadError && (
        <p role="alert" className="mt-8 text-sm text-(--color-danger)">
          {loadError}
        </p>
      )}
      {!loading && !loadError && reports.length === 0 && (
        <p className="mt-8 text-sm text-(--color-ink-faint)">Walang reports na kailangang i-validate.</p>
      )}

      <ul className="mt-6 space-y-4">
        {reports.map((report) => {
          const depth = getFloodDepthOption(report.floodDepth);
          return (
            <li key={report.id} className="rounded-2xl border border-(--color-border) bg-(--color-surface) p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-(--color-ink)">{report.locationName}</p>
                  <p className="text-xs text-(--color-ink-faint)">
                    {formatPhTime(report.reportedAt)} · {formatRelativeTime(report.reportedAt)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-(--color-neutral-status-bg) px-2.5 py-1 text-xs font-semibold text-(--color-neutral-status)">
                  {report.status}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <p>
                  <span className="text-(--color-ink-faint)">Depth: </span>
                  <span className="font-medium text-(--color-ink)">{depth.label}</span>
                </p>
                <p>
                  <span className="text-(--color-ink-faint)">Road: </span>
                  <span className="font-medium text-(--color-ink)">{report.roadCondition ?? "—"}</span>
                </p>
                <p>
                  <span className="text-(--color-ink-faint)">Reporter: </span>
                  <span className="font-medium text-(--color-ink)">
                    {report.anonymous || !report.reporterName ? "Anonymous" : report.reporterName}
                  </span>
                </p>
                <p>
                  <span className="text-(--color-ink-faint)">Validations: </span>
                  <span className="font-medium text-(--color-ink)">
                    {report.validationCount} validate · {report.denyCount} deny
                  </span>
                </p>
                <p className="col-span-2">
                  <span className="text-(--color-ink-faint)">Community: </span>
                  <span className="font-medium text-(--color-ink)">
                    {report.stillFloodedCount} baha pa · {report.noLongerFloodedCount} wala na ·{" "}
                    {report.accurateCount} tama · {report.inaccurateCount} mali
                  </span>
                </p>
              </div>

              <div className="mt-3">
                <MapViewLoader
                  center={{ latitude: report.latitude, longitude: report.longitude }}
                  reports={[report]}
                  zoom={15}
                  heightClassName="h-40"
                  // Moderators act via the Validate/Deny buttons below;
                  // the map here is a location preview, not a voting surface.
                  allowValidation={false}
                />
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={actingOnId === report.id}
                  onClick={() => handleAction(report.id, "VALIDATE")}
                  className="flex-1 rounded-full bg-(--color-safe) px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  ✓ Validate
                </button>
                <button
                  type="button"
                  disabled={actingOnId === report.id}
                  onClick={() => handleAction(report.id, "DENY")}
                  className="flex-1 rounded-full border border-(--color-danger) px-4 py-2 text-sm font-semibold text-(--color-danger) hover:bg-(--color-danger-bg) disabled:opacity-50"
                >
                  ✕ Deny
                </button>
                <button
                  type="button"
                  disabled={actingOnId === report.id}
                  onClick={() => handleAction(report.id, "FLAG")}
                  className="rounded-full border border-(--color-border) px-3 py-2 text-sm font-medium text-(--color-ink-muted) hover:bg-(--color-paper) disabled:opacity-50"
                >
                  Flag
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
