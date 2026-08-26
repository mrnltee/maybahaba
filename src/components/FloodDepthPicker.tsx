"use client";

import { DepthIcon } from "@/components/DepthIcon";
import { FloodScene } from "@/components/FloodScene";
import {
  DEPTH_SCALE,
  formatWaterline,
  getCodeAtIndex,
  getScaleIndex,
  isImpassable,
} from "@/lib/floodScale";
import { getMmdaAssessment } from "@/lib/mmda";
import { getFloodDepthOption, type FloodDepthCode } from "@/lib/types";
import { AlertTriangle } from "lucide-react";

/**
 * The one field a report cannot be submitted without, so it gets the most
 * care.
 *
 * Props are unchanged from the card-grid version this replaces — one
 * `value`, one `onChange` — so the report form keeps its single source of
 * truth and needed no edits. The slider, the label column and the scene
 * are three views of that same value; none of them holds state.
 *
 * Why a slider rather than eight cards: depth is a continuum people
 * already understand through their own body, and eight equally-weighted
 * cards made the reader compare labels instead of picturing water. The
 * scene answers "gaano kalalim?" without reading.
 *
 * Accessibility: this is a real `<input type="range">`, so keyboard,
 * screen readers and assistive tech get it for free. `aria-valuetext`
 * carries the Filipino label — a bare "4 of 8" would be meaningless. The
 * scene is aria-hidden because every fact it conveys is also in text.
 */
export function FloodDepthPicker({
  value,
  onChange,
}: {
  value: FloodDepthCode | null;
  onChange: (code: FloodDepthCode) => void;
}) {
  // Nothing chosen yet reads as the shallowest rung, so the scene starts
  // dry rather than blank — but `value` stays null until the user acts,
  // so the form's own "please pick a depth" validation is untouched.
  const current = value ?? "WALANG_BAHA";
  const index = getScaleIndex(current);
  const option = getFloodDepthOption(current);
  const max = DEPTH_SCALE.length - 1;
  const waterline = formatWaterline(current);
  const impassable = isImpassable(current);
  const mmda = getMmdaAssessment(current);

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-(--color-ink)">Gaano kalalim?</legend>

      <div className="mt-3 rounded-2xl border border-(--color-border) bg-(--color-surface) p-3 sm:p-4">
        {/* Mobile stacks the scene above the controls rather than shrinking
            the desktop row — side by side at 390px left the illustration a
            sliver, which defeats the point of having one. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          {/* ---- Slider + label column ---- */}
          <div className="order-2 flex shrink-0 gap-2 sm:order-1">
            <input
              type="range"
              min={0}
              max={max}
              step={1}
              value={index}
              onChange={(e) => onChange(getCodeAtIndex(Number(e.target.value)))}
              aria-label="Gaano kalalim ang baha?"
              aria-orientation="vertical"
              aria-valuetext={`${option.label}. ${option.description}`}
              className="mbb-depth-slider h-56 w-8 shrink-0 cursor-pointer accent-(--color-brand) sm:h-64"
            />

            {/* Labels. Reversed so the deepest sits at the top, matching
                the direction the water actually rises. */}
            <ol className="flex h-56 flex-col justify-between text-right sm:h-64">
              {[...DEPTH_SCALE].reverse().map((o) => {
                const active = o.code === current;
                return (
                  <li key={o.code} className="flex items-center">
                    <button
                      type="button"
                      onClick={() => onChange(o.code)}
                      aria-pressed={active}
                      // min-h-6 (24px) so each label clears WCAG 2.5.8.
                      // Stacked with leading-none they were ~11px tall —
                      // a real target-size failure, not a rounding one.
                      className={`flex min-h-6 items-center whitespace-nowrap rounded px-1 text-left text-[11px] leading-none transition-colors sm:text-xs ${
                        active
                          ? "font-bold text-(--color-ink)"
                          : "text-(--color-ink-faint) hover:text-(--color-ink-muted)"
                      }`}
                    >
                      {o.label}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* ---- Scene ---- */}
          <div className="order-1 min-w-0 flex-1 sm:order-2">
            <FloodScene code={current} className="w-full" />

            <div className="mt-2 flex items-start gap-2 border-t border-(--color-border) pt-2">
              <DepthIcon code={current} className="mt-0.5 h-8 w-8 shrink-0" />
              <div className="min-w-0">
                <p
                  aria-live="polite"
                  className="text-sm font-bold text-(--color-ink)"
                >
                  {option.label}
                  {waterline && (
                    <span className="ml-1.5 font-normal text-(--color-ink-faint)">
                      · {waterline}
                    </span>
                  )}
                </p>
                <p className="text-xs text-(--color-ink-muted)">{option.description}</p>

                {/* MMDA's own assessment, derived from the depth in
                    centimetres rather than hand-assigned — see lib/mmda.ts.
                    Attributed, because it is their classification and not
                    ours to restate as fact. */}
                {mmda && (
                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                    <span
                      className={`rounded px-1.5 py-0.5 font-bold ${
                        mmda.band === "NPATV"
                          ? "bg-(--color-danger-bg) text-(--color-danger)"
                          : mmda.band === "NPLV"
                            ? "bg-(--color-warn-bg) text-(--color-warn)"
                            : "bg-(--color-safe-bg) text-(--color-safe)"
                      }`}
                      title={mmda.expansion}
                    >
                      {mmda.code}
                    </span>
                    <span className="text-(--color-ink-muted)">{mmda.label}</span>
                    <span className="sr-only">
                      ({mmda.expansion}, ayon sa MMDA flood gauge)
                    </span>
                    <span className="text-(--color-ink-faint)">· MMDA</span>
                  </p>
                )}
              </div>
            </div>

            {impassable && (
              <p
                role="status"
                className="mt-2 flex items-start gap-1.5 rounded-lg bg-(--color-danger-bg) px-2.5 py-2 text-xs font-medium text-(--color-danger)"
              >
                <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Iwasan ang rutang ito. Ayon sa MMDA, hindi na madaanan ng kahit anong
                sasakyan ang baha na ganito kalalim.
              </p>
            )}
          </div>
        </div>
      </div>
    </fieldset>
  );
}
