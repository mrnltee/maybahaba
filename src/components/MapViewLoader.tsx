"use client";

import dynamic from "next/dynamic";

import "leaflet/dist/leaflet.css";

/** Client-only wrapper — Leaflet reads `window` at import time, so it must never run during SSR. */
export const MapViewLoader = dynamic(() => import("./MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <div className="h-80 w-full animate-pulse-soft rounded-2xl border border-(--color-border) bg-(--color-paper)" />
  ),
});
