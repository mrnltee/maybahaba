"use client";

import { EXTERNAL_MAP_TARGETS } from "@/lib/externalMaps";
import { ExternalLink } from "lucide-react";

interface ExternalMapLinksProps {
  latitude: number;
  longitude: number;
  label?: string;
  compact?: boolean;
  /**
   * Renders as a bare row of links with no heading, for sitting beside a
   * primary button. Keeps these secondary actions from reading as their
   * own section.
   */
  inline?: boolean;
}

/**
 * "Open this flood location in…" — hands off to whichever map app the
 * motorist already uses. See lib/externalMaps.ts for why these show the
 * location rather than navigating to it.
 */
export function ExternalMapLinks({
  latitude,
  longitude,
  label,
  compact = false,
  inline = false,
}: ExternalMapLinksProps) {
  // Sized for one-handed outdoor tapping, not just the 24x24 AA floor.
  const linkClass = compact
    ? "inline-flex min-h-9 items-center gap-1 rounded-full border border-(--color-border-strong) px-3 py-1.5 text-[11px] font-medium text-(--color-ink) hover:bg-(--color-paper)"
    : "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-(--color-border-strong) px-4 py-2 text-xs font-medium text-(--color-ink) hover:bg-(--color-paper)";

  const links = (
    <ul
      className="flex flex-wrap gap-1.5"
      aria-label={inline ? "Buksan ang lokasyon sa ibang map app" : undefined}
      aria-labelledby={inline ? undefined : "open-in-maps-label"}
    >
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
  );

  if (inline) return links;

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <p className={`text-(--color-ink-muted) ${compact ? "text-[11px]" : "text-xs"}`} id="open-in-maps-label">
        Buksan sa ibang app
      </p>
      {links}
    </div>
  );
}
