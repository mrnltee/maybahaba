"use client";

import { AdminSignIn } from "@/components/AdminSignIn";
import { DepthIcon } from "@/components/DepthIcon";
import { getReportFreshness } from "@/lib/freshness";
import { formatPhTime, formatRelativeTime } from "@/lib/time";
import {
  ROAD_CONDITION_LABELS,
  VEHICLE_TYPE_LABELS,
  getFloodDepthOption,
  type FloodReport,
  type ReportStatus,
} from "@/lib/types";
import { ArrowLeft, Download, Printer } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type StatusFilter = "ALL" | ReportStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "Lahat" },
  { value: "PENDING", label: "Pending" },
  { value: "VALIDATED", label: "Validated" },
  { value: "FLAGGED", label: "Flagged" },
  { value: "DENIED", label: "Denied" },
  { value: "EXPIRED", label: "Expired" },
];

const STATUS_STYLES: Record<ReportStatus, string> = {
  PENDING: "bg-(--color-neutral-status-bg) text-(--color-neutral-status)",
  VALIDATED: "bg-(--color-safe-bg) text-(--color-safe)",
  FLAGGED: "bg-(--color-warn-bg) text-(--color-warn)",
  DENIED: "bg-(--color-danger-bg) text-(--color-danger)",
  EXPIRED: "bg-(--color-neutral-status-bg) text-(--color-neutral-status)",
};

const COLUMNS = [
  "Lalim",
  "Oras (PH)",
  "Lokasyon",
  "Kalsada",
  "Sasakyan",
  "Nag-report",
  "Status",
  "Validation",
];

/**
 * Moderator table: every report ever filed, whatever its status.
 *
 * Separate from /admin/validate, which is a focused queue for judging one
 * report at a time. This is the ledger — for auditing, spotting repeat
 * abuse from one name, and exporting.
 */
/**
 * One state value rather than four booleans. Modelling the load as a
 * discriminated union makes the impossible states (loading *and* errored,
 * unauthorised *with* rows) unrepresentable, and it means the whole
 * transition is a single setState after the fetch resolves — so nothing
 * is set synchronously inside the effect.
 */
type LoadState =
  | { phase: "loading" }
  | { phase: "unauthed" }
  | { phase: "error"; message: string }
  | { phase: "ready"; reports: FloodReport[] };

export default function AdminReportsPage() {
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/reports");
      if (res.status === 401) {
        setState({ phase: "unauthed" });
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setState({ phase: "error", message: data.error ?? "Hindi ma-load ang reports." });
        return;
      }
      setState({ phase: "ready", reports: data.reports });
    } catch {
      setState({
        phase: "error",
        message: "Mukhang offline ka. Check your connection and try again.",
      });
    }
  }, []);

  useEffect(() => {
    // The rule can't see through the async boundary: every setState in
    // `load` sits after `await fetch(...)`, so none of them runs during
    // the effect's synchronous pass. Fetching on mount is also the
    // intended use of an effect here — this is a client page reading a
    // cookie-gated endpoint, so it can't be a server component.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (state.phase === "unauthed") {
    return (
      <AdminSignIn
        onSignedIn={() => {
          setState({ phase: "loading" });
          load();
        }}
      />
    );
  }

  const reports = state.phase === "ready" ? state.reports : [];

  const filtered = reports
    .filter((r) => (status === "ALL" ? true : r.status === status))
    .filter((r) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return [r.locationName, r.street, r.barangay, r.city, r.province, r.reporterName]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-(--color-ink-muted) hover:text-(--color-ink) print:hidden"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Bumalik sa MayBahaBa
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-(--color-ink)">Lahat ng reports</h1>
          <p className="mt-1 text-sm text-(--color-ink-muted)">
            Moderator view — kasama ang denied at expired. Hindi ito nakikita ng public.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <a
            href="/api/admin/reports?format=csv"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-(--color-border-strong) px-4 py-2 text-sm font-semibold text-(--color-ink) hover:bg-(--color-paper)"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            I-export (CSV)
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-(--color-border-strong) px-4 py-2 text-sm font-semibold text-(--color-ink) hover:bg-(--color-paper)"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            I-print
          </button>
          <Link
            href="/admin/validate"
            className="inline-flex min-h-11 items-center rounded-full bg-(--color-brand) px-4 py-2 text-sm font-semibold text-(--color-brand-ink) hover:bg-(--color-brand-hover)"
          >
            Validation queue
          </Link>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 print:hidden">
        <label className="sr-only" htmlFor="admin-search">
          Maghanap ng lugar o reporter
        </label>
        <input
          id="admin-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Hanapin ang lugar o reporter…"
          className="min-h-11 min-w-48 flex-1 rounded-full border border-(--color-border-strong) bg-(--color-surface) px-4 py-2 text-sm text-(--color-ink)"
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Salain ayon sa status">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatus(f.value)}
              aria-pressed={status === f.value}
              className={`min-h-11 rounded-full border px-3 py-1.5 text-sm font-medium ${
                status === f.value
                  ? "border-(--color-brand) bg-(--color-brand) text-(--color-brand-ink)"
                  : "border-(--color-border-strong) bg-(--color-surface) text-(--color-ink)"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {state.phase === "loading" && (
        <p className="mt-8 text-sm text-(--color-ink-faint)">Naglo-load…</p>
      )}
      {state.phase === "error" && (
        <p role="alert" className="mt-8 text-sm text-(--color-danger)">
          {state.message}
        </p>
      )}

      {state.phase === "ready" && (
        <>
          {/* aria-live so a screen-reader user hears the count change when
              they filter, since the table itself is too large to re-read. */}
          <p aria-live="polite" className="mt-4 text-sm text-(--color-ink-muted)">
            {filtered.length} sa {reports.length} reports
          </p>

          {filtered.length === 0 ? (
            <p className="mt-6 text-sm text-(--color-ink-faint)">Walang tugmang report.</p>
          ) : (
            <>
              {/* Phone: cards. A 8-column table on a 390px screen shows two
                  columns and hides the rest behind a horizontal scroll most
                  people never discover — so below `sm` each report becomes a
                  self-contained card instead. The table returns at `sm`,
                  where scanning many rows at once is the point. */}
              <ul className="mt-3 space-y-3 sm:hidden">
                {filtered.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-xl border border-(--color-border) bg-(--color-surface) p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Depth report={r} />
                      <StatusBadge report={r} />
                    </div>
                    <p className="mt-2 text-sm text-(--color-ink-muted)">{r.locationName}</p>
                    <p className="text-xs text-(--color-ink-faint)">
                      {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                    </p>
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                      <dt className="text-(--color-ink-faint)">Oras</dt>
                      <dd className="text-(--color-ink-muted)">
                        {formatPhTime(r.reportedAt)} · {getReportFreshness(r).label}
                      </dd>
                      <dt className="text-(--color-ink-faint)">Kalsada</dt>
                      <dd className="text-(--color-ink-muted)">{roadLabel(r)}</dd>
                      <dt className="text-(--color-ink-faint)">Sasakyan</dt>
                      <dd className="text-(--color-ink-muted)">{vehicleLabel(r)}</dd>
                      <dt className="text-(--color-ink-faint)">Nag-report</dt>
                      <dd className="text-(--color-ink-muted)">{reporterLabel(r)}</dd>
                    </dl>
                    <p className="mt-2 border-t border-(--color-border) pt-2 text-xs text-(--color-ink-faint)">
                      ✓{r.validationCount} ✕{r.denyCount} · baha pa {r.stillFloodedCount} · wala na{" "}
                      {r.noLongerFloodedCount} · tama {r.accurateCount} · mali {r.inaccurateCount}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="mt-3 hidden overflow-x-auto rounded-xl border border-(--color-border) sm:block">
                <table className="w-full min-w-[58rem] border-collapse text-sm">
                  <caption className="sr-only">
                    Lahat ng flood reports, kasama ang denied at expired
                  </caption>
                  <thead className="bg-(--color-paper) text-left">
                    <tr>
                      {COLUMNS.map((h) => (
                        <th
                          key={h}
                          scope="col"
                          className="whitespace-nowrap px-3 py-2 font-semibold text-(--color-ink)"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id} className="border-t border-(--color-border) align-top">
                        <td className="px-3 py-2">
                          <Depth report={r} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-(--color-ink-muted)">
                          {formatPhTime(r.reportedAt)}
                          <span className="block text-xs text-(--color-ink-faint)">
                            {formatRelativeTime(r.reportedAt)} · {getReportFreshness(r).label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-(--color-ink-muted)">
                          {r.locationName}
                          <span className="block text-xs text-(--color-ink-faint)">
                            {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-(--color-ink-muted)">{roadLabel(r)}</td>
                        <td className="px-3 py-2 text-(--color-ink-muted)">{vehicleLabel(r)}</td>
                        <td className="px-3 py-2 text-(--color-ink-muted)">{reporterLabel(r)}</td>
                        <td className="px-3 py-2">
                          <StatusBadge report={r} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-(--color-ink-muted)">
                          ✓{r.validationCount} ✕{r.denyCount}
                          <span className="block text-(--color-ink-faint)">
                            baha pa {r.stillFloodedCount} · wala na {r.noLongerFloodedCount}
                          </span>
                          <span className="block text-(--color-ink-faint)">
                            tama {r.accurateCount} · mali {r.inaccurateCount}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}

/* ---- Cells shared by the phone cards and the desktop table ---------- */

function roadLabel(r: FloodReport): string {
  return r.roadCondition ? ROAD_CONDITION_LABELS[r.roadCondition] : "—";
}

function vehicleLabel(r: FloodReport): string {
  return r.vehicleTypes.length
    ? r.vehicleTypes.map((v) => VEHICLE_TYPE_LABELS[v] ?? v).join(", ")
    : "—";
}

function reporterLabel(r: FloodReport): string {
  return r.anonymous || !r.reporterName ? "Anonymous" : r.reporterName;
}

function Depth({ report }: { report: FloodReport }) {
  return (
    <span className="flex items-center gap-2">
      <DepthIcon code={report.floodDepth} className="h-6 w-6 shrink-0" />
      <span className="font-medium text-(--color-ink)">
        {getFloodDepthOption(report.floodDepth).label}
      </span>
    </span>
  );
}

function StatusBadge({ report }: { report: FloodReport }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[report.status]}`}
    >
      {report.status}
    </span>
  );
}
