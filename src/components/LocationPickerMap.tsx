"use client";

import type L from "leaflet";
import { useEffect, useRef } from "react";

interface LocationPickerMapProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  onChange: (lat: number, lng: number) => void;
  heightClassName?: string;
}

/**
 * Interactive pin-drop map for the Report Baha form (spec section 9/20).
 * Tap/click anywhere, or drag the marker, to set the exact report
 * location. Client-only (see LocationPickerMapLoader).
 */
export function LocationPickerMap({
  latitude,
  longitude,
  zoom = 16,
  onChange,
  heightClassName = "h-64",
}: LocationPickerMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);

  // Keep the latest callback in a ref without mutating it during render.
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;

    import("leaflet").then((leafletModule) => {
      if (cancelled || !containerRef.current) return;
      const L = leafletModule.default;

      const map = L.map(containerRef.current, {
        center: [latitude, longitude],
        zoom,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const icon = L.divIcon({
        className: "",
        html: `<div style="width:26px;height:26px;transform:translateY(-4px)">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="#0f5c73" stroke="white" stroke-width="1"><path d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z"/></svg>
        </div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 26],
      });

      const marker = L.marker([latitude, longitude], { icon, draggable: true, alt: "Lokasyon ng baha" }).addTo(map);
      markerRef.current = marker;

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        onChangeRef.current(pos.lat, pos.lng);
      });

      map.on("click", (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        onChangeRef.current(e.latlng.lat, e.latlng.lng);
      });
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reflect external position changes (e.g. "Use my location" or search selection)
  // without re-creating the whole map.
  useEffect(() => {
    if (mapRef.current && markerRef.current) {
      markerRef.current.setLatLng([latitude, longitude]);
      mapRef.current.setView([latitude, longitude], mapRef.current.getZoom());
    }
  }, [latitude, longitude]);

  return (
    <div
      ref={containerRef}
      className={`w-full ${heightClassName} rounded-xl border border-(--color-border)`}
      role="application"
      aria-label="Piliin ang lokasyon sa mapa. I-click o i-drag ang pin."
    />
  );
}
