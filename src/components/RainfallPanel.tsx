"use client";

import { PAGASA_NCR_FORECAST_URL, type RainfallReading } from "@/lib/rainfall";
import { formatRelativeTime } from "@/lib/time";
import { CloudRain, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Rainfall context, placed beneath the flood reports rather than above
 * them.
 *
 * Position is a safety decision, not a layout one. The reports are what
 * the app can actually stand behind; rainfall is background. Putting a
 * big weather number at the top would make it read as the headline
 * answer to "is it flooded?", which it is not.
 *
 * Three rules this component follows and should keep following:
 *
 *  - It never uses the flood palette. No red, orange or yellow, however
 *    hard it is raining, because those are PAGASA's warning colours and
 *    borrowing them would counterfeit an official advisory.
 *  - It never says anything about roads, passability, or flooding.
 *  - It disappears entirely on failure rather than showing a zero.
 */
export function RainfallPanel({
  latitude,
  longitude,
  areaLabel,
}: {
  latitude: number;
  longitude: number;
  areaLabel?: string;
}) {
  const [reading, setReading] = useState<RainfallReading | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/rainfall?lat=${latitude}&lng=${longitude}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.reading) setReading(data.reading);
      })
      .catch(() => {
        // Context is optional. Silence is the correct failure mode.
      });
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  return (
    <section
      aria-labelledby="rainfall-heading"
      className="mt-4 rounded-xl border border-(--color-border) bg-(--color-surface) p-4"
    >
      <h2
        id="rainfall-heading"
        className="flex items-center gap-2 text-sm font-semibold text-(--color-ink)"
      >
        <CloudRain className="h-4 w-4 shrink-0 text-(--color-ink-muted)" aria-hidden="true" />
        Ulan sa paligid
      </h2>

      {reading ? (
        <>
          <p className="mt-2 text-base font-medium text-(--color-ink)">{reading.band.label}</p>
          <p className="mt-0.5 text-sm text-(--color-ink-muted)">{reading.band.detail}</p>
          <p className="mt-1 text-xs text-(--color-ink-faint)">
            Tantiyang {reading.mmLastHour.toFixed(1)} mm sa nakaraang oras
            {areaLabel ? ` malapit sa ${areaLabel}` : ""} · {formatRelativeTime(reading.observedAt)}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-(--color-ink-muted)">
          Walang datos ng ulan para sa lugar na ito ngayon.
        </p>
      )}

      {/* The disclaimer is not fine print — it is the reason this panel is
          allowed to exist at all, so it gets real contrast and sits above
          the attribution rather than below it. */}
      <p className="mt-3 border-t border-(--color-border) pt-3 text-xs text-(--color-ink-muted)">
        Tantiya ito mula sa weather model — <strong className="font-semibold">hindi</strong> ito
        sukat ng ulan sa mismong kalsada, at{" "}
        <strong className="font-semibold">hindi ito nangangahulugan na may baha o wala</strong>.
        Maaaring bumaha kahit tumigil na ang ulan.
      </p>

      <a
        href={PAGASA_NCR_FORECAST_URL}
        target="_blank"
        rel="noopener noreferrer"
        // `inline` rather than `inline-flex`: when the label wraps onto two
        // lines, a flex icon is pushed to the far right and reads as
        // unrelated. Inline keeps it attached to the last word.
        className="mt-2 inline-block py-2.5 text-sm font-semibold text-(--color-brand) underline underline-offset-2 hover:text-(--color-brand-hover)"
      >
        Tingnan ang opisyal na babala ng PAGASA
        <ExternalLink
          className="ml-1 inline-block h-3.5 w-3.5 align-[-0.125em]"
          aria-hidden="true"
        />
        <span className="sr-only">(bubukas sa bagong tab)</span>
      </a>

      {/* Open-Meteo is CC-BY 4.0 — attribution is a licence condition,
          not a courtesy. */}
      <p className="mt-2 text-xs text-(--color-ink-faint)">
        Datos ng ulan mula sa{" "}
        <a
          href="https://open-meteo.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          Open-Meteo
        </a>{" "}
        (CC BY 4.0).
      </p>
    </section>
  );
}
