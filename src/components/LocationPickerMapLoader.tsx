"use client";

import dynamic from "next/dynamic";

export const LocationPickerMapLoader = dynamic(
  () => import("./LocationPickerMap").then((m) => m.LocationPickerMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 w-full animate-pulse-soft rounded-xl border border-(--color-border) bg-(--color-paper)" />
    ),
  }
);
