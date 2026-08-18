"use client";

import { FloodDepthPicker } from "@/components/FloodDepthPicker";
import { LocationPickerMapLoader } from "@/components/LocationPickerMapLoader";
import { Modal } from "@/components/Modal";
import { SearchBox } from "@/components/SearchBox";
import { useGeolocation } from "@/hooks/useGeolocation";
import { METRO_MANILA_CENTER } from "@/lib/geo";
import { formatPhTimeShort, phLocalInputToUtcIso, utcIsoToPhLocalInput } from "@/lib/time";
import {
  VEHICLE_TYPE_OPTIONS,
  type DuplicateCheckResult,
  type FloodDepthCode,
  type FloodReport,
  type LocationResult,
  type RoadConditionCode,
  type VehicleTypeCode,
} from "@/lib/types";
import { getFloodDepthOption } from "@/lib/types";
import { formatRelativeTime } from "@/lib/time";
import { Check, CheckCircle2, LocateFixed, Map as MapIcon, MapPinned, TriangleAlert } from "lucide-react";
import { useEffect, useId, useState } from "react";

interface ReportBahaModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (report: FloodReport) => void;
  /**
   * Pre-fills the location, e.g. when the user tapped a spot on the map.
   * Consumed as initial state, so the caller should remount the modal
   * (via a changing `key`) to apply a new one.
   */
  initialLocation?: { latitude: number; longitude: number } | null;
}

type SelectedLocation = {
  latitude: number;
  longitude: number;
  label: string;
  street: string | null;
  barangay: string | null;
  city: string | null;
  province: string | null;
};

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "duplicate"; check: DuplicateCheckResult; message: string }
  | { kind: "error"; message: string }
  | { kind: "success"; report: FloodReport };

export function ReportBahaModal({ open, onClose, onSuccess, initialLocation }: ReportBahaModalProps) {
  const titleId = useId();
  const { getCurrentPosition, loading: locating } = useGeolocation();

  const [location, setLocation] = useState<SelectedLocation | null>(
    initialLocation
      ? {
          latitude: initialLocation.latitude,
          longitude: initialLocation.longitude,
          label: "Naka-pin na lokasyon",
          street: null,
          barangay: null,
          city: null,
          province: null,
        }
      : null
  );
  const [showMap, setShowMap] = useState(Boolean(initialLocation));
  const [locationError, setLocationError] = useState<string | null>(null);

  const [reportedAtLocal, setReportedAtLocal] = useState(() => utcIsoToPhLocalInput(new Date().toISOString()));
  const [floodDepth, setFloodDepth] = useState<FloodDepthCode | null>(null);
  const [roadCondition, setRoadCondition] = useState<RoadConditionCode | "">("");
  const [vehicleTypes, setVehicleTypes] = useState<VehicleTypeCode[]>([]);
  const [reporterName, setReporterName] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [showOptional, setShowOptional] = useState(false);

  const [submitState, setSubmitState] = useState<SubmitState>({ kind: "idle" });

  function reset() {
    setLocation(null);
    setShowMap(false);
    setLocationError(null);
    setReportedAtLocal(utcIsoToPhLocalInput(new Date().toISOString()));
    setFloodDepth(null);
    setRoadCondition("");
    setVehicleTypes([]);
    setReporterName("");
    setAnonymous(true);
    setShowOptional(false);
    setSubmitState({ kind: "idle" });
  }

  function handleClose() {
    onClose();
    // Delay reset slightly so closing animation (if any) doesn't flash empty state.
    setTimeout(reset, 200);
  }

  function handleSearchSelect(result: LocationResult) {
    setLocation({
      latitude: result.latitude,
      longitude: result.longitude,
      label: result.label,
      street: result.street,
      barangay: result.barangay,
      city: result.city,
      province: result.province,
    });
    setLocationError(null);
    setShowMap(true);
  }

  async function handleUseMyLocation() {
    setLocationError(null);
    try {
      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;
      setShowMap(true);
      setLocation({ latitude, longitude, label: "Kasalukuyang lokasyon", street: null, barangay: null, city: null, province: null });
      const res = await fetch(`/api/search?lat=${latitude}&lng=${longitude}`);
      const data = await res.json();
      if (data.result) {
        setLocation({
          latitude,
          longitude,
          label: data.result.label,
          street: data.result.street,
          barangay: data.result.barangay,
          city: data.result.city,
          province: data.result.province,
        });
      }
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : "Hindi makuha ang lokasyon.");
    }
  }

  async function handlePinChange(lat: number, lng: number) {
    setLocation((prev) => ({
      latitude: lat,
      longitude: lng,
      label: prev?.label ?? "Naka-pin na lokasyon",
      street: prev?.street ?? null,
      barangay: prev?.barangay ?? null,
      city: prev?.city ?? null,
      province: prev?.province ?? null,
    }));
    try {
      const res = await fetch(`/api/search?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      if (data.result) {
        setLocation({
          latitude: lat,
          longitude: lng,
          label: data.result.label,
          street: data.result.street,
          barangay: data.result.barangay,
          city: data.result.city,
          province: data.result.province,
        });
      }
    } catch {
      // Keep the pin even if reverse geocoding fails — coordinates are still valid.
    }
  }

  // When the user arrived here by tapping the map, resolve those raw
  // coordinates into a readable address so the report isn't filed as
  // "Naka-pin na lokasyon". Runs once per mount; the caller remounts via
  // `key` when the pinned location changes.
  useEffect(() => {
    if (initialLocation) {
      void handlePinChange(initialLocation.latitude, initialLocation.longitude);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openBlankMap() {
    setLocation((prev) => prev ?? { ...METRO_MANILA_CENTER, label: "", street: null, barangay: null, city: null, province: null });
    setShowMap(true);
  }

  function toggleVehicleType(code: VehicleTypeCode) {
    setVehicleTypes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  async function submitReport(acknowledgedDuplicateId: string | null) {
    if (!location || !floodDepth) return;

    setSubmitState({ kind: "submitting" });
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          locationName: location.label || "Naka-pin na lokasyon",
          street: location.street,
          barangay: location.barangay,
          city: location.city,
          province: location.province,
          floodDepth,
          roadCondition: roadCondition || null,
          vehicleTypes,
          reportedAt: phLocalInputToUtcIso(reportedAtLocal),
          reporterName: anonymous ? null : reporterName.trim() || null,
          anonymous,
          acknowledgedDuplicateId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitState({ kind: "error", message: data.error ?? "Hindi na-submit ang report." });
        return;
      }

      if (data.duplicateWarning) {
        setSubmitState({ kind: "duplicate", check: data.duplicateCheck, message: data.message });
        return;
      }

      setSubmitState({ kind: "success", report: data.report });
      onSuccess?.(data.report);
    } catch {
      setSubmitState({ kind: "error", message: "Mukhang offline ka. Check your connection and try again." });
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitReport(null);
  }

  const canSubmit = Boolean(location && floodDepth) && submitState.kind !== "submitting";

  return (
    <Modal open={open} onClose={handleClose} titleId={titleId} title="Report Baha">
      {submitState.kind === "success" ? (
        <div className="py-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-(--color-safe)" aria-hidden="true" />
          <p className="mt-4 text-lg font-semibold text-(--color-ink)">Salamat sa report mo!</p>
          <p className="mt-1 text-sm text-(--color-ink-muted)">
            Naipasa na ang report para sa {submitState.report.locationName}. Makakatulong ito sa ibang motorista.
          </p>
          <button
            type="button"
            onClick={handleClose}
            className="mt-6 inline-flex items-center rounded-full bg-(--color-brand) px-5 py-2.5 text-sm font-semibold text-(--color-brand-ink) hover:bg-(--color-brand-hover)"
          >
            Isara
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-sm font-semibold text-(--color-ink)" htmlFor="report-location-search">
              Where is the flooding?
            </label>
            <div className="mt-2" id="report-location-search">
              <SearchBox
                placeholder="Search location..."
                onSelect={handleSearchSelect}
                initialValue={location?.label ?? ""}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={locating}
                className="inline-flex items-center gap-1.5 rounded-full border border-(--color-border-strong) px-3 py-1.5 text-xs font-medium text-(--color-ink) hover:bg-(--color-paper) disabled:opacity-60"
              >
                <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
                {locating ? "Kinukuha ang lokasyon…" : "Use My Location"}
              </button>
              <button
                type="button"
                onClick={openBlankMap}
                className="inline-flex items-center gap-1.5 rounded-full border border-(--color-border-strong) px-3 py-1.5 text-xs font-medium text-(--color-ink) hover:bg-(--color-paper)"
              >
                <MapIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Pin on Map
              </button>
            </div>
            {locationError && <p className="mt-2 text-sm text-(--color-danger)">{locationError}</p>}

            {/*
              The resolved address, shown explicitly.

              Previously this only lived inside SearchBox's `initialValue`,
              which is initial state — so pinning the map or using current
              location reverse-geocoded correctly but the name never
              appeared. You were filing reports without being able to see
              where they'd land.
            */}
            {location && (
              <div
                aria-live="polite"
                className="mt-3 flex items-start gap-2 rounded-xl border border-(--color-border) bg-(--color-paper) px-3 py-2.5"
              >
                <MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-(--color-ink-faint)" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-(--color-ink)">
                    {location.label || "Naka-pin na lokasyon"}
                  </p>
                  <p className="text-xs text-(--color-ink-faint)">
                    {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                  </p>
                </div>
              </div>
            )}

            {showMap && location && (
              <div className="mt-3">
                <LocationPickerMapLoader
                  latitude={location.latitude}
                  longitude={location.longitude}
                  onChange={handlePinChange}
                />
                <p className="mt-1 text-xs text-(--color-ink-faint)">
                  I-tap o i-drag ang pin para i-adjust ang eksaktong lokasyon.
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold text-(--color-ink)" htmlFor="report-time">
              Anong oras mo nakita?
            </label>
            <input
              id="report-time"
              type="datetime-local"
              value={reportedAtLocal}
              onChange={(e) => setReportedAtLocal(e.target.value)}
              max={utcIsoToPhLocalInput(new Date().toISOString())}
              className="mt-2 w-full rounded-xl border border-(--color-border-strong) bg-(--color-surface) px-4 py-3 text-sm text-(--color-ink) focus-visible:outline-3 focus-visible:outline-(--color-brand)"
            />
            {/*
              Time is what matters to a motorist — "as of 5:42 PM" is the
              whole point. The date stays in the input because a report
              filed just after midnight would otherwise be ambiguous, but
              the feedback line below is phrased in the terms a reader
              cares about, so a mis-set date is obvious before submitting.
            */}
            <p aria-live="polite" className="mt-1.5 text-xs text-(--color-ink-muted)">
              Ire-report bilang:{" "}
              <span className="font-medium text-(--color-ink)">
                {formatRelativeTime(phLocalInputToUtcIso(reportedAtLocal))}
              </span>{" "}
              ({formatPhTimeShort(phLocalInputToUtcIso(reportedAtLocal))})
            </p>
          </div>

          <FloodDepthPicker value={floodDepth} onChange={setFloodDepth} />

          <div>
            <button
              type="button"
              onClick={() => setShowOptional((v) => !v)}
              className="text-sm font-medium text-(--color-brand) underline-offset-2 hover:underline"
              aria-expanded={showOptional}
            >
              {showOptional ? "Itago ang optional details" : "Add optional details"}
            </button>

            {showOptional && (
              <div className="mt-3 space-y-5">
                {/*
                  A single tick rather than a four-option scale. Reporters
                  could not reliably separate "with caution" from
                  "difficult", and a binary they answer honestly is worth
                  more than a gradient they guess at. Older reports keep
                  their finer-grained values (see ROAD_CONDITION_LABELS).
                */}
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-(--color-border-strong) bg-(--color-surface) px-3 py-2.5 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-(--color-brand)">
                  <input
                    type="checkbox"
                    checked={roadCondition === "NOT_PASSABLE"}
                    onChange={(e) => setRoadCondition(e.target.checked ? "NOT_PASSABLE" : "PASSABLE")}
                    className="h-5 w-5 shrink-0 accent-(--color-brand)"
                  />
                  <span>
                    <span className="block text-sm font-medium text-(--color-ink)">
                      Hindi madaanan ang kalsada
                    </span>
                    <span className="block text-xs text-(--color-ink-muted)">
                      Iwanang blangko kung nadaanan mo naman.
                    </span>
                  </span>
                </label>

                <fieldset>
                  <legend className="text-sm font-medium text-(--color-ink)">
                    Anong sasakyan ang apektado?
                  </legend>
                  <p className="mt-0.5 text-xs text-(--color-ink-muted)">
                    Puwedeng higit sa isa.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {VEHICLE_TYPE_OPTIONS.map((o) => {
                      const checked = vehicleTypes.includes(o.code);
                      return (
                        <label
                          key={o.code}
                          className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-(--color-brand) ${
                            checked
                              ? "border-(--color-brand) bg-(--color-brand)/5 font-semibold text-(--color-ink)"
                              : "border-(--color-border-strong) bg-(--color-surface) text-(--color-ink)"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleVehicleType(o.code)}
                            className="sr-only"
                          />
                          {checked && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                          {o.label}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold text-(--color-ink)" htmlFor="reporter-name">
              Reported by
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                id="reporter-name"
                type="text"
                disabled={anonymous}
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder="Optional name / nickname"
                maxLength={60}
                className="flex-1 rounded-xl border border-(--color-border-strong) bg-(--color-surface) px-4 py-2.5 text-sm text-(--color-ink) disabled:opacity-50"
              />
            </div>
            <label className="mt-2 flex items-center gap-2 text-sm text-(--color-ink-muted)">
              <input
                type="checkbox"
                checked={anonymous}
                onChange={(e) => setAnonymous(e.target.checked)}
                className="h-4 w-4 accent-(--color-brand)"
              />
              Mag-post nang anonymous
            </label>
          </div>

          {submitState.kind === "duplicate" && (
            <div className="rounded-xl border border-(--color-warn) bg-(--color-warn-bg) p-4">
              <div className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-(--color-warn)" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-(--color-ink)">{submitState.message}</p>
                  {submitState.check.existingReport && (
                    <p className="mt-1 text-sm text-(--color-ink-muted)">
                      {getFloodDepthOption(submitState.check.existingReport.floodDepth).label} ·{" "}
                      {formatRelativeTime(submitState.check.existingReport.reportedAt)}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-(--color-ink-faint)">{submitState.check.reason}</p>
                  <button
                    type="button"
                    onClick={() => submitReport(submitState.check.existingReport?.id ?? null)}
                    className="mt-3 inline-flex items-center rounded-full bg-(--color-brand) px-4 py-2 text-xs font-semibold text-(--color-brand-ink) hover:bg-(--color-brand-hover)"
                  >
                    Submit pa rin / Submit anyway
                  </button>
                </div>
              </div>
            </div>
          )}

          {submitState.kind === "error" && (
            <p role="alert" className="text-sm font-medium text-(--color-danger)">
              {submitState.message}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-full bg-(--color-brand) px-5 py-3.5 text-sm font-semibold text-(--color-brand-ink) hover:bg-(--color-brand-hover) disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitState.kind === "submitting" ? "Sinusubmit…" : "Submit Report"}
          </button>
        </form>
      )}
    </Modal>
  );
}
