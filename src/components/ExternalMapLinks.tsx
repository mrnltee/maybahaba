"use client";

import { EXTERNAL_MAP_TARGETS } from "@/lib/externalMaps";
import { ExternalLink } from "lucide-react";

interface ExternalMapLinksProps {
  latitude: number;
  longitude: number;
  label?: string;
  compact?: boolean;
}

/**
 * "Open this flood location in…" — hands off to whichever map app the
 * motorist already uses. See lib/externalMaps.ts for why these show the
 * location rather than navigating to it.
 */
export function ExternalMapLinks({ latitude, longitude, label, compact = false }: ExternalMapLinksProps) {
  const linkClass = compact
    ? "inline-flex items-center gap-1 rounded-full border border-(--color-border) px-2.5 py-1 text-[11px] font-medium text-(--color-ink) hover:bg-(--color-paper)"
    : "inline-flex items-center gap-1.5 rounded-full border border-(--color-border) px-3 py-1.5 text-xs font-medium text-(--color-ink) hover:bg-(--color-paper)";

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <p className={`text-(--color-ink-muted) ${compact ? "text-[11px]" : "text-xs"}`} id="open-in-maps-label">
        Buksan sa ibang app
      </p>
      <ul className="flex flex-wrap gap-1.5" aria-labelledby="open-in-maps-label">
        {EXTERNAL_MAP_TARGETS.map((target) => (
          <li key={target.id}>
            <a
              href={target.buildUrl(latitude, longitude, label)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${target.description} (magbubukas sa bagong tab)`}
              className={linkClass}
            >
              {target.label}
              <ExternalLink className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
