"use client";

import { ValidationControls } from "@/components/ValidationControls";
import { DEPTH_MAP_COLOR, MAP_LEGEND } from "@/lib/mapColors";
import { formatRelativeTime } from "@/lib/time";
import { getFloodDepthOption, type FloodReport } from "@/lib/types";
import type L from "leaflet";
import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";

interface MapViewProps {
  center: { latitude: number; longitude: number };
  reports: FloodReport[];
  zoom?: number;
  heightClassName?: string;
  focusedReportId?: string | null;
  /** Omit to render read-only markers with no community validation controls. */
  onReportUpdated?: (report: FloodReport) => void;
  /** Whether popups offer community validation. Defaults to true. */
  allowValidation?: boolean;
}

/**
 * Flood report map. OpenStreetMap tiles + Leaflet — free, no API key
 * (spec section 18/29). Loaded client-side only via dynamic import (see
 * MapViewLoader) since Leaflet touches `window`.
 *
 * Popups mount a real React subtree so the same ValidationControls
 * component is used here and on the result card — no duplicated markup
 * or a second copy of the voting logic.
 */
export function MapView({
  center,
  reports,
  zoom = 15,
  heightClassName = "h-80",
  focusedReportId,
  onReportUpdated,
  allowValidation = true,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const rootsRef = useRef<Root[]>([]);
  const onReportUpdatedRef = useRef(onReportUpdated);

  useEffect(() => {
    onReportUpdatedRef.current = onReportUpdated;
  }, [onReportUpdated]);

  useEffect(() => {
    let cancelled = false;

    import("leaflet").then((leafletModule) => {
      if (cancelled || !containerRef.current) return;
      const L = leafletModule.default;

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          center: [center.latitude, center.longitude],
          zoom,
          scrollWheelZoom: true,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(mapRef.current);
      } else {
        mapRef.current.setView([center.latitude, center.longitude], zoom);
      }

      // Tear down previous markers and any React roots they owned.
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      rootsRef.current.forEach((root) => queueMicrotask(() => root.unmount()));
      rootsRef.current = [];

      // Center marker (the searched location).
      const centerIcon = L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;border-radius:9999px;background:#0f5c73;border:2px solid white;box-shadow:0 0 0 2px #0f5c73;"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const centerMarker = L.marker([center.latitude, center.longitude], {
        icon: centerIcon,
        keyboard: false,
        alt: "Hinahanap na lokasyon",
      }).addTo(mapRef.current);
      markersRef.current.push(centerMarker);

      for (const report of reports) {
        const color = DEPTH_MAP_COLOR[report.floodDepth];
        const isFocused = report.id === focusedReportId;
        const size = isFocused ? 22 : 16;
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const depth = getFloodDepthOption(report.floodDepth);
        const marker = L.marker([report.latitude, report.longitude], {
          icon,
          alt: `${depth.label} sa ${report.locationName}`,
        }).addTo(mapRef.current!);

        const popupEl = document.createElement("div");
        popupEl.style.minWidth = "210px";
        popupEl.style.fontFamily = "inherit";

        const header = document.createElement("div");
        header.innerHTML = `
          <p style="font-weight:600;margin:0 0 4px">${escapeHtml(depth.label)}</p>
          <p style="margin:0 0 4px;color:#4b5359;font-size:13px">${escapeHtml(report.locationName)}</p>
          <p style="margin:0;color:#767f85;font-size:12px">${escapeHtml(formatRelativeTime(report.reportedAt))}${
            report.isDemoData ? " · DEMO DATA" : ""
          }</p>`;
        popupEl.appendChild(header);

        if (allowValidation) {
          const mount = document.createElement("div");
          mount.style.marginTop = "10px";
          mount.style.paddingTop = "8px";
          mount.style.borderTop = "1px solid #dcd7cd";
          popupEl.appendChild(mount);

          // Mount lazily — only when the user actually opens this popup,
          // so a map with many markers doesn't create dozens of roots.
          let mounted = false;
          marker.on("popupopen", () => {
            if (mounted) return;
            mounted = true;
            const root = createRoot(mount);
            rootsRef.current.push(root);
            root.render(
              <ValidationControls
                report={report}
                compact
                onVoted={(updated) => onReportUpdatedRef.current?.(updated)}
              />
            );
          });
        }

        marker.bindPopup(popupEl);
        markersRef.current.push(marker);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [center.latitude, center.longitude, zoom, reports, focusedReportId, allowValidation]);

  useEffect(() => {
    return () => {
      rootsRef.current.forEach((root) => queueMicrotask(() => root.unmount()));
      rootsRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div>
      <div
        ref={containerRef}
        className={`w-full ${heightClassName} rounded-2xl border border-(--color-border)`}
        role="application"
        aria-label="Flood report map"
      />
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-(--color-ink-muted)">
        {MAP_LEGEND.map((item) => (
          <li key={item.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
