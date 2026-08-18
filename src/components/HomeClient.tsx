"use client";

import { Header } from "@/components/Header";
import { MapViewLoader } from "@/components/MapViewLoader";
import { ReportBahaModal } from "@/components/ReportBahaModal";
import { AreaResultCard } from "@/components/AreaResultCard";
import { ResultCard } from "@/components/ResultCard";
import { ResultSkeleton } from "@/components/Skeleton";
import { SearchBox } from "@/components/SearchBox";
import { SearchControls } from "@/components/SearchControls";
import { useDeviceLocation } from "@/hooks/useDeviceLocation";
import { NEARBY_RADIUS_METERS } from "@/lib/config/freshness";
import { distanceMeters } from "@/lib/geo";
import { isAreaSearch, type AreaSearchResult, type FloodReport, type LocationResult, type NearbySearchResult } from "@/lib/types";
import Link from "next/link";
import { useState } from "react";

export function HomeClient({ isUsingMockData }: { isUsingMockData: boolean }) {
  const [reportModalOpen, setReportModalOpen] = useState(false);
  /**
   * Coordinates the user tapped on the map, pre-filled into the report
   * form. `modalKey` remounts the modal so those coordinates are picked
   * up as fresh initial state rather than needing a sync effect.
   */
  const [pinnedLocation, setPinnedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [modalKey, setModalKey] = useState(0);
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null);
  const [result, setResult] = useState<NearbySearchResult | null>(null);
  const [areaResult, setAreaResult] = useState<AreaSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [radiusMeters, setRadiusMeters] = useState<number>(NEARBY_RADIUS_METERS);
  const device = useDeviceLocation();

  async function handleSelectLocation(location: LocationResult, radius: number = radiusMeters) {
    setSelectedLocation(location);
    setShowMap(false);
    setError(null);
    setLoading(true);
    setResult(null);
    setAreaResult(null);

    // A city/barangay/province has no single condition, so it gets a
    // different query and a different answer shape (see AreaResultCard).
    const area = isAreaSearch(location);

    try {
      const url = area
        ? `/api/reports/in-area?minLat=${location.boundingBox!.minLat}&minLon=${location.boundingBox!.minLon}` +
          `&maxLat=${location.boundingBox!.maxLat}&maxLon=${location.boundingBox!.maxLon}` +
          `&label=${encodeURIComponent(location.label)}`
        : `/api/reports/nearby?lat=${location.latitude}&lng=${location.longitude}&radius=${radius}`;

      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Hindi available ang report service ngayon. Subukan ulit.");
      } else if (area) {
        setAreaResult(data);
      } else {
        setResult(data);
      }
    } catch {
      setError("Mukhang offline ka. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function refreshResult() {
    if (selectedLocation) handleSelectLocation(selectedLocation, radiusMeters);
  }

  /** Changing the radius re-runs the current search rather than needing a re-search. */
  function handleRadiusChange(meters: number) {
    setRadiusMeters(meters);
    if (selectedLocation) handleSelectLocation(selectedLocation, meters);
  }

  /** "Use my location" both grants distances and searches where you are. */
  async function handleUseMyLocation() {
    const loc = await device.request();
    if (!loc) return;
    let label = "Kasalukuyang lokasyon";
    let street = null, barangay = null, city = null, province = null;
    try {
      const res = await fetch(`/api/search?lat=${loc.latitude}&lng=${loc.longitude}`);
      const data = await res.json();
      if (data.result) {
        label = data.result.label;
        street = data.result.street; barangay = data.result.barangay;
        city = data.result.city; province = data.result.province;
      }
    } catch {
      // Coordinates are enough to search with.
    }
    handleSelectLocation({
      id: "device", label, latitude: loc.latitude, longitude: loc.longitude,
      street, barangay, city, province, kind: "other",
    });
  }

  function openReportModal(pin: { latitude: number; longitude: number } | null) {
    setPinnedLocation(pin);
    setModalKey((k) => k + 1);
    setReportModalOpen(true);
  }

  /**
   * Patch a single report in place after someone confirms it, so the
   * counts and "huling kumpirmado" update immediately without refetching
   * and without the result card flickering back through its skeleton.
   */
  function handleReportUpdated(updated: FloodReport) {
    setResult((prev) => {
      if (!prev) return prev;
      const patch = (r: FloodReport) => (r.id === updated.id ? updated : r);
      return {
        ...prev,
        topReport: prev.topReport ? patch(prev.topReport) : null,
        nearbyReports: prev.nearbyReports.map(patch),
      };
    });
  }

  return (
    <>
      <Header onReportClick={() => openReportModal(null)} />

      <main id="main-content" className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:px-6 sm:py-16">
        {isUsingMockData && (
          <p className="mb-6 rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-2 text-center text-xs text-(--color-ink-faint)">
            Running on local demo data — no database is connected yet. See README for Supabase setup.
          </p>
        )}

        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-(--color-ink) sm:text-5xl">May baha ba?</h1>
          <p className="mt-3 text-(--color-ink-muted)">Search a street, barangay, city, or province.</p>
        </div>

        <div className="mx-auto mt-8 w-full max-w-xl">
          <SearchBox
            onSelect={(loc) => handleSelectLocation(loc)}
            autoFocus
            deviceLocation={device.location}
          />
          <SearchControls
            onSelectLocation={(loc) => handleSelectLocation(loc)}
            onUseMyLocation={handleUseMyLocation}
            locating={device.loading}
            locationError={device.error}
            radiusMeters={radiusMeters}
            onRadiusChange={handleRadiusChange}
          />
        </div>

        <div className="mx-auto mt-8 w-full max-w-xl">
          {loading && <ResultSkeleton />}

          {!loading && error && (
            <div role="alert" className="rounded-2xl border border-(--color-danger) bg-(--color-danger-bg) p-6 text-center">
              <p className="text-sm font-medium text-(--color-danger)">{error}</p>
            </div>
          )}

          {!loading && !error && areaResult && selectedLocation && (
            <>
              <AreaResultCard
                result={areaResult}
                locationLabel={selectedLocation.label}
                deviceLocation={device.location}
                onViewOnMap={() => setShowMap((v) => !v)}
              />
              {showMap && (
                <div className="mt-4">
                  <MapViewLoader
                    center={{ latitude: selectedLocation.latitude, longitude: selectedLocation.longitude }}
                    reports={areaResult.reports}
                    zoom={12}
                    heightClassName="h-96"
                    onReportUpdated={handleReportUpdated}
                    onReportHere={(lat, lng) => openReportModal({ latitude: lat, longitude: lng })}
                  />
                </div>
              )}
            </>
          )}

          {!loading && !error && result && selectedLocation && (
            <>
              <ResultCard
                result={result}
                locationLabel={selectedLocation.label}
                onViewOnMap={() => setShowMap((v) => !v)}
                onReportUpdated={handleReportUpdated}
                radiusMeters={radiusMeters}
                distanceFromDevice={
                  device.location
                    ? distanceMeters(
                        device.location.latitude,
                        device.location.longitude,
                        selectedLocation.latitude,
                        selectedLocation.longitude
                      )
                    : null
                }
              />
              {showMap && (
                <div className="mt-4">
                  <MapViewLoader
                    center={{ latitude: selectedLocation.latitude, longitude: selectedLocation.longitude }}
                    reports={result.nearbyReports}
                    focusedReportId={result.topReport?.id ?? null}
                    onReportUpdated={handleReportUpdated}
                    onReportHere={(lat, lng) => openReportModal({ latitude: lat, longitude: lng })}
                    radiusMeters={radiusMeters}
                  />
                </div>
              )}
            </>
          )}

          {!loading && !error && !result && !areaResult && (
            <p className="text-center text-sm text-(--color-ink-faint)">
              Maghanap ng lokasyon para makita ang pinakabagong report ng baha doon.
            </p>
          )}
        </div>
      </main>

      <footer className="border-t border-(--color-border) px-4 py-6 text-center text-xs text-(--color-ink-faint)">
        <p>
          MayBahaBa ay isang community platform — hindi ito opisyal na serbisyo ng gobyerno.{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-(--color-ink)">
            Privacy notice
          </Link>
        </p>
      </footer>

      <ReportBahaModal
        key={modalKey}
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        onSuccess={refreshResult}
        initialLocation={pinnedLocation}
      />
    </>
  );
}
