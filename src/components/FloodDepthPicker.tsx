"use client";

import { DepthIcon } from "@/components/DepthIcon";
import { FLOOD_DEPTH_OPTIONS, type FloodDepthCode } from "@/lib/types";

/**
 * The one field a report cannot be submitted without, so it gets the most
 * care. Each option pairs a waterline icon with its Filipino label and a
 * plain-language description — the icons make the eight levels scannable
 * as a single rising scale, the text carries the actual meaning.
 */
export function FloodDepthPicker({
  value,
  onChange,
}: {
  value: FloodDepthCode | null;
  onChange: (code: FloodDepthCode) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-(--color-ink)">Gaano kalalim?</legend>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {FLOOD_DEPTH_OPTIONS.map((option) => {
          const selected = value === option.code;
          return (
            <label
              key={option.code}
              // The radio itself is visually hidden, so the label has to
              // surface its focus state — otherwise keyboard users get no
              // indicator at all (WCAG 2.4.7).
              className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-(--color-brand) has-[:focus-visible]:outline-offset-2 ${
                selected
                  ? "border-(--color-brand) bg-(--color-brand)/5 ring-1 ring-(--color-brand)"
                  : "border-(--color-border-strong) bg-(--color-surface) hover:bg-(--color-paper)"
              }`}
            >
              <input
                type="radio"
                name="floodDepth"
                value={option.code}
                checked={selected}
                onChange={() => onChange(option.code)}
                className="sr-only"
              />
              <DepthIcon code={option.code} className="h-9 w-9 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-(--color-ink)">{option.label}</span>
                <span className="block text-xs text-(--color-ink-muted)">{option.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
