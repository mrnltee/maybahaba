"use client";

import { FLOOD_DEPTH_OPTIONS, type FloodDepthCode } from "@/lib/types";

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
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                selected
                  ? "border-(--color-brand) bg-(--color-brand)/5"
                  : "border-(--color-border) bg-(--color-surface) hover:bg-(--color-paper)"
              }`}
            >
              <input
                type="radio"
                name="floodDepth"
                value={option.code}
                checked={selected}
                onChange={() => onChange(option.code)}
                className="mt-1 h-4 w-4 accent-(--color-brand)"
              />
              <span>
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
