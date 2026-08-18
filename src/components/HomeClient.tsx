"use client";

import { Header } from "@/components/Header";
import { MapViewLoader } from "@/components/MapViewLoader";
import { ReportBahaModal } from "@/components/ReportBahaModal";
import { ResultCard } from "@/components/ResultCard";
import { ResultSkeleton } from "@/components/Skeleton";
import { SearchBox } from "@/components/SearchBox";
import type { FloodReport, LocationResult, NearbySearchResult } from "@/lib/types";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);

  async function handleSelectLocation(location: LocationResult) {
    setSelectedLocation(location);
    setShowMap(false);
    setError(null);
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`/api/reports/nearby?lat=${location.latitude}&lng=${location.longitude}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Hindi available ang report service ngayon. Subukan ulit.");
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
    if (selectedLocation) handleSelectLocation(selectedLocation);
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
          <SearchBox onSelect={handleSelectLocation} autoFocus />
        </div>

        <div className="mx-auto mt-8 w-full max-w-xl">
          {loading && <ResultSkeleton />}

          {!loading && error && (
            <div role="alert" className="rounded-2xl border border-(--color-danger) bg-(--color-danger-bg) p-6 text-center">
              <p className="text-sm font-medium text-(--color-danger)">{error}</p>
            </div>
          )}

          {!loading && !error && result && selectedLocation && (
            <>
              <ResultCard
                result={result}
                locationLabel={selectedLocation.label}
                onViewOnMap={() => setShowMap((v) => !v)}
                onReportUpdated={handleReportUpdated}
              />
              {showMap && (
                <div className="mt-4">
                  <MapViewLoader
                    center={{ latitude: selectedLocation.latitude, longitude: selectedLocation.longitude }}
                    reports={result.nearbyReports}
                    focusedReportId={result.topReport?.id ?? null}
                    onReportUpdated={handleReportUpdated}
                    onReportHere={(lat, lng) => openReportModal({ latitude: lat, longitude: lng })}
                  />
                </div>
              )}
            </>
          )}

          {!loading && !error && !result && (
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
