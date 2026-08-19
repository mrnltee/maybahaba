"use client";

import { FollowUpFlow } from "@/components/FollowUpFlow";
import { AccuracyControls } from "@/components/ValidationControls";
import { DEPTH_MAP_COLOR, DISPUTED_MAP_COLOR, MAP_LEGEND, isDisputed } from "@/lib/mapColors";
import { formatRelativeTime } from "@/lib/time";
import { getFloodDepthOption, type FloodReport } from "@/lib/types";
import { OPEN_WEATHER_RAINFALL } from "@/lib/weatherLayers";
import type L from "leaflet";
import { CloudRain } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  /**
   * When provided, tapping empty map space drops a pin and offers to file
   * a report there. Omit to make the map read-only.
   */
  onReportHere?: (latitude: number, longitude: number) => void;
  /**
   * Draws the search radius as a circle so the answer's scope is visible.
   * Without it, "3 reports nearby" gives no sense of how much ground that
   * covers — 300 m and 10 km look identical on a card.
   */
  radiusMeters?: number | null;
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
  onReportHere,
  radiusMeters = null,
}: MapViewProps) {
  /**
   * Off by default. Someone opening this map wants to know whether a road
   * is flooded; a blue wash over everything is not the first thing they
   * asked for (spec: rainfall is supporting context).
   */
  const [showRainfall, setShowRainfall] = useState(false);
  /**
   * null = not asked yet. Only asked once the user turns the layer on,
   * so a visitor who never touches it costs no request.
   *
   * Needed because a blank overlay has three very different causes — no
   * key configured, a key the provider rejected, or simply no rain in
   * view — and the tile proxy deliberately renders all three as
   * transparent tiles. Without this the empty map is unexplainable.
   */
  const [rainConfigured, setRainConfigured] = useState<boolean | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const rootsRef = useRef<Root[]>([]);
  const radiusCircleRef = useRef<L.Circle | null>(null);
  const onReportUpdatedRef = useRef(onReportUpdated);
  const onReportHereRef = useRef(onReportHere);
  /** Transient "you tapped here" pin, replaced on each new tap. */
  const tapMarkerRef = useRef<L.Marker | null>(null);
  /**
   * The rainfall overlay, held separately from the base layer so it can
   * be added and removed without touching the map's view. Nothing in
   * this ref's lifecycle calls setView, fitBounds or panTo — the spec is
   * explicit that enabling weather must never re-centre the map, and the
   * way to guarantee that is for the layer code to have no access to the
   * view at all.
   */
  const rainLayerRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    onReportUpdatedRef.current = onReportUpdated;
  }, [onReportUpdated]);

  useEffect(() => {
    onReportHereRef.current = onReportHere;
  }, [onReportHere]);

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

        // The rainfall overlay is constructed but NOT added — the toggle
        // decides that. Building it here means flipping the toggle costs
        // no setup work and, more importantly, that its creation is not
        // entangled with the map's initial view.
        rainLayerRef.current = L.tileLayer(OPEN_WEATHER_RAINFALL.tileUrlTemplate, {
          attribution: OPEN_WEATHER_RAINFALL.attribution,
          opacity: OPEN_WEATHER_RAINFALL.opacity,
          // Past this zoom OpenWeather has no more detail; Leaflet
          // upscales the last real tile instead of requesting tiles that
          // would come back blank.
          maxNativeZoom: OPEN_WEATHER_RAINFALL.maxNativeZoom,
          maxZoom: 19,
          // Stays in the tile pane, below the marker pane. Report pins
          // therefore render above the rain, and because tile layers are
          // non-interactive the overlay cannot swallow a marker tap.
          pane: "tilePane",
          className: "maybahaba-rain-layer",
        });

        // Tap empty map space to file a report at that exact spot. Bound
        // once, on map creation, so re-renders don't stack handlers.
        mapRef.current.on("click", (e: L.LeafletMouseEvent) => {
          const handler = onReportHereRef.current;
          if (!handler || !mapRef.current) return;

          tapMarkerRef.current?.remove();

          const pin = L.divIcon({
            className: "",
            html: `<div style="width:26px;height:26px;transform:translateY(-4px)">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="#0f5c73" stroke="white" stroke-width="1"><path d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8zm0 11a3 3 0 110-6 3 3 0 010 6z"/></svg>
            </div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 26],
          });

          const marker = L.marker(e.latlng, { icon: pin, alt: "Napiling lokasyon" }).addTo(mapRef.current);
          tapMarkerRef.current = marker;

          const el = document.createElement("div");
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = "Mag-report ng baha dito";
          btn.style.cssText =
            "background:#0f5c73;color:#fff;border:none;border-radius:9999px;padding:8px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit";
          btn.onclick = () => {
            marker.closePopup();
            handler(e.latlng.lat, e.latlng.lng);
          };
          el.appendChild(btn);

          marker.bindPopup(el).openPopup();
        });
      } else {
        mapRef.current.setView([center.latitude, center.longitude], zoom);
      }

      // Tear down previous markers and any React roots they owned.
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      rootsRef.current.forEach((root) => queueMicrotask(() => root.unmount()));
      rootsRef.current = [];

      // Search-radius circle, drawn beneath the markers.
      radiusCircleRef.current?.remove();
      radiusCircleRef.current = null;
      if (radiusMeters && radiusMeters > 0) {
        radiusCircleRef.current = L.circle([center.latitude, center.longitude], {
          radius: radiusMeters,
          color: "#0f5c73",
          weight: 1.5,
          opacity: 0.7,
          fillColor: "#0f5c73",
          fillOpacity: 0.07,
          interactive: false,
        }).addTo(mapRef.current);
        // Frame the circle so the whole search area is visible at once.
        mapRef.current.fitBounds(radiusCircleRef.current.getBounds(), { padding: [16, 16] });
      }

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
        // Disputed reports drop out of the depth palette entirely — see
        // isDisputed() for why they stay on the map at all.
        const disputed = isDisputed(report);
        const color = disputed ? DISPUTED_MAP_COLOR : DEPTH_MAP_COLOR[report.floodDepth];
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
          alt: `${depth.label} sa ${report.locationName}${disputed ? " (di-beripikado)" : ""}`,
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
          }</p>
          ${
            disputed
              ? '<p style="margin:6px 0 0;color:#8b9096;font-size:12px;font-weight:600">Di-beripikado — may nagsabing mali ang report na ito.</p>'
              : ""
          }`;
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
              <div className="space-y-2">
                <FollowUpFlow
                  report={report}
                  compact
                  onUpdated={(updated: FloodReport) => onReportUpdatedRef.current?.(updated)}
                />
                <AccuracyControls
                  report={report}
                  compact
                  onVoted={(updated: FloodReport) => onReportUpdatedRef.current?.(updated)}
                />
              </div>
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
  }, [center.latitude, center.longitude, zoom, reports, focusedReportId, allowValidation, radiusMeters]);

  useEffect(() => {
    return () => {
      rootsRef.current.forEach((root) => queueMicrotask(() => root.unmount()));
      rootsRef.current = [];
      radiusCircleRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  /**
   * Add or remove the overlay when the toggle changes.
   *
   * Its own effect, depending only on `showRainfall`. Keeping it apart
   * from the map-creation effect is what stops a weather toggle from
   * re-running anything to do with centring, and means a slow or failing
   * tile provider cannot delay the base map or the report pins.
   */
  useEffect(() => {
    if (!showRainfall || rainConfigured !== null) return;
    let cancelled = false;
    fetch("/api/weather-tiles/status")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setRainConfigured(Boolean(d.configured));
      })
      .catch(() => {
        if (!cancelled) setRainConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showRainfall, rainConfigured]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = rainLayerRef.current;
    if (!map || !layer) return;
    if (showRainfall) {
      if (!map.hasLayer(layer)) layer.addTo(map);
    } else if (map.hasLayer(layer)) {
      map.removeLayer(layer);
    }
  }, [showRainfall]);

  return (
    <div>
      <div
        ref={containerRef}
        className={`w-full ${heightClassName} rounded-2xl border border-(--color-border)`}
        role="application"
        aria-label="Flood report map"
      />
      {onReportHere && (
        <p className="mt-2 text-xs text-(--color-ink-faint)">
          I-tap ang mapa para mag-report ng baha sa eksaktong lugar na iyon.
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-xs font-medium text-(--color-ink)">
          <input
            type="checkbox"
            checked={showRainfall}
            onChange={(e) => setShowRainfall(e.target.checked)}
            className="h-4 w-4 accent-(--color-brand)"
          />
          <CloudRain className="h-4 w-4 text-(--color-ink-muted)" aria-hidden="true" />
          {OPEN_WEATHER_RAINFALL.name}
        </label>
      </div>

      {showRainfall && (
        <div className="mt-2 rounded-xl border border-(--color-border) bg-(--color-paper) p-3">
          <p className="text-xs font-semibold text-(--color-ink)">
            Lakas ng ulan{" "}
            <span className="font-normal text-(--color-ink-muted)">
              — hindi ito lalim ng baha
            </span>
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-(--color-ink-muted)">
            {OPEN_WEATHER_RAINFALL.legend.map((band) => (
              <li key={band.label} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-4 rounded-sm"
                  style={{ backgroundColor: band.colour }}
                  aria-hidden="true"
                />
                {band.label} <span className="text-(--color-ink-faint)">{band.range}</span>
              </li>
            ))}
          </ul>
          {/* The same boundary RainfallPanel draws, restated here because
              a user who enabled this layer may never have scrolled to
              that panel. Rain in the sky is not water on the road. */}
          <p className="mt-2 text-xs text-(--color-ink-muted)">
            Tantiyang lakas ng ulan mula sa weather model —{" "}
            <strong className="font-semibold">hindi ito babala ng baha</strong>. Ang mga pin ang
            nagsasabi ng kondisyon sa kalsada.
          </p>

          {/*
            Why the overlay might look empty. Without this the three
            causes are indistinguishable, which is exactly the confusion
            the silent tile fallback creates.
          */}
          {rainConfigured === false ? (
            <p
              role="status"
              className="mt-2 border-t border-(--color-border) pt-2 text-xs text-(--color-warn)"
            >
              Hindi pa available ang rainfall layer — wala pang naka-configure na weather data
              source. Gumagana pa rin ang mapa at ang mga report.
            </p>
          ) : (
            rainConfigured === true && (
              <p className="mt-2 border-t border-(--color-border) pt-2 text-xs text-(--color-ink-faint)">
                Kung walang kulay sa mapa, walang naitalang ulan sa bahaging ito ngayon.
              </p>
            )
          )}
        </div>
      )}

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-(--color-ink-muted)">
        <li className="w-full text-xs font-semibold text-(--color-ink)">Kondisyon sa kalsada</li>
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
