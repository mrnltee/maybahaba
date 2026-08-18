"use client";

import { LocationPickerMapLoader } from "@/components/LocationPickerMapLoader";
import { SEARCH_RADIUS_OPTIONS_METERS, formatRadius } from "@/lib/config/freshness";
import { METRO_MANILA_CENTER } from "@/lib/geo";
import type { LocationResult } from "@/lib/types";
import { LocateFixed, Map as MapIcon } from "lucide-react";
import { useState } from "react";

interface SearchControlsProps {
  onSelectLocation: (location: LocationResult) => void;
  onUseMyLocation: () => void;
  locating: boolean;
  locationError: string | null;
  radiusMeters: number;
  onRadiusChange: (meters: number) => void;
}

/**
 * The controls sitting under the landing search box.
 *
 * These used to exist only inside the report modal, which meant you could
 * pin a location to *report* a flood but not to *check* one — the more
 * common action by far.
 */
export function SearchControls({
  onSelectLocation,
  onUseMyLocation,
  locating,
  locationError,
  radiusMeters,
  onRadiusChange,
}: SearchControlsProps) {
  const [pinning, setPinning] = useState(false);
  const [pin, setPin] = useState({ ...METRO_MANILA_CENTER });

  async function confirmPin() {
    // Resolve the dropped pin into a readable place name before handing
    // it upward, so the result card has something to show besides
    // coordinates. Falls back to coordinates if the geocoder is down.
    let label = `${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}`;
    let street: string | null = null;
    let barangay: string | null = null;
    let city: string | null = null;
    let province: string | null = null;

    try {
      const res = await fetch(`/api/search?lat=${pin.latitude}&lng=${pin.longitude}`);
      const data = await res.json();
      if (data.result) {
        label = data.result.label;
        street = data.result.street;
        barangay = data.result.barangay;
        city = data.result.city;
        province = data.result.province;
      }
    } catch {
      // Keep the coordinate label — the pin is still a valid place to search.
    }

    onSelectLocation({
      id: `pin:${pin.latitude},${pin.longitude}`,
      label,
      latitude: pin.latitude,
      longitude: pin.longitude,
      street,
      barangay,
      city,
      province,
      kind: "other",
    });
    setPinning(false);
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onUseMyLocation}
          disabled={locating}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-(--color-border-strong) px-4 py-2 text-sm font-medium text-(--color-ink) hover:bg-(--color-surface) disabled:opacity-60"
        >
          <LocateFixed className="h-4 w-4" aria-hidden="true" />
          {locating ? "Kinukuha…" : "Use my location"}
        </button>

        <button
          type="button"
          onClick={() => setPinning((v) => !v)}
          aria-expanded={pinning}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-(--color-border-strong) px-4 py-2 text-sm font-medium text-(--color-ink) hover:bg-(--color-surface)"
        >
          <MapIcon className="h-4 w-4" aria-hidden="true" />
          {pinning ? "Isara ang mapa" : "Pin on map"}
        </button>

        <label className="ml-auto inline-flex min-h-11 items-center gap-2 text-sm text-(--color-ink-muted)">
          <span className="whitespace-nowrap">Layo:</span>
          <select
            value={radiusMeters}
            onChange={(e) => onRadiusChange(Number(e.target.value))}
            aria-label="Lawak ng paghahanap"
            className="min-h-11 rounded-full border border-(--color-border-strong) bg-(--color-surface) px-3 py-2 text-sm font-medium text-(--color-ink)"
          >
            {SEARCH_RADIUS_OPTIONS_METERS.map((m) => (
              <option key={m} value={m}>
                {formatRadius(m)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {locationError && (
        <p role="alert" className="mt-2 text-sm text-(--color-danger)">
          {locationError}
        </p>
      )}

      {pinning && (
        <div className="mt-3 rounded-2xl border border-(--color-border) bg-(--color-surface) p-3">
          <LocationPickerMapLoader
            latitude={pin.latitude}
            longitude={pin.longitude}
            onChange={(lat, lng) => setPin({ latitude: lat, longitude: lng })}
            heightClassName="h-56"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-(--color-ink-faint)">
              I-tap ang mapa para pumili ng lugar.
            </p>
            <button
              type="button"
              onClick={confirmPin}
              className="inline-flex min-h-11 items-center rounded-full bg-(--color-brand) px-4 py-2 text-sm font-semibold text-(--color-brand-ink) hover:bg-(--color-brand-hover)"
            >
              Tingnan dito
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
