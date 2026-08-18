import { getFloodDepthOption, type FloodDepthCode } from "@/lib/types";

/**
 * A waterline indicator for each flood depth.
 *
 * Deliberately not an icon-set glyph: no stock icon means "water up to
 * your shin". This draws the actual thing being described — a fill level
 * rising through a fixed frame — so the eight options read as one scale
 * you can scan, rather than eight unrelated pictures.
 *
 * Purely decorative: every use is accompanied by the depth's text label,
 * so it carries aria-hidden and adds nothing for screen readers.
 */
export function DepthIcon({
  code,
  className = "h-9 w-9",
}: {
  code: FloodDepthCode;
  className?: string;
}) {
  const { severity } = getFloodDepthOption(code);
  const maxSeverity = 7;

  // Fill height as a fraction of the frame. Severity 0 keeps a sliver of
  // "ground" visible so "Walang Baha" still reads as a road, not empty.
  const fraction = severity === 0 ? 0.06 : 0.12 + (severity / maxSeverity) * 0.82;
  const frameTop = 3;
  const frameHeight = 18;
  const waterHeight = frameHeight * fraction;
  const waterY = frameTop + frameHeight - waterHeight;

  // Colour tracks the same scale as the map markers.
  const fill =
    severity === 0
      ? "var(--color-safe)"
      : severity <= 1
        ? "#c9a227"
        : severity <= 3
          ? "#d97a1f"
          : severity <= 6
            ? "#c1401f"
            : "#6b1414";

  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      {/* frame / roadway */}
      <rect
        x="3"
        y={frameTop}
        width="18"
        height={frameHeight}
        rx="3"
        fill="var(--color-paper)"
        stroke="var(--color-border-strong)"
        strokeWidth="1"
      />
      {/* water */}
      <rect x="3.5" y={waterY} width="17" height={waterHeight} rx="2.5" fill={fill} opacity="0.85" />
      {/* waterline, so shallow levels are still legible */}
      <line
        x1="3.5"
        y1={waterY}
        x2="20.5"
        y2={waterY}
        stroke={fill}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* impassable gets an unmistakable cross-bar */}
      {code === "HINDI_MADAANAN" && (
        <path
          d="M7 8.5 L17 17.5 M17 8.5 L7 17.5"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
