"use client";

import { DepthIcon } from "@/components/DepthIcon";
import { getFollowUpDepthChoices, getFollowUpPrompt } from "@/lib/followUp";
import { getFloodDepthOption, type FloodDepthCode, type FloodReport } from "@/lib/types";
import { Check } from "lucide-react";
import { useId, useState } from "react";

type Phase = "asking" | "picking" | "sending" | "done" | "dismissed" | "error";

/**
 * "Tulungan ang susunod" — the status-dependent follow-up conversation.
 *
 * All the branching lives in lib/followUp.ts; this component only
 * renders what that module returns and reports the answer back. That
 * separation is why the eight scenarios can be tested without a browser.
 *
 * Filing an update creates a NEW report rather than editing this one, so
 * the card visibly moves on while the original stays in the record. See
 * the follow-up route for why.
 */
export function FollowUpFlow({
  report,
  compact = false,
  onUpdated,
}: {
  report: FloodReport;
  /** Tighter styling for the Leaflet popup. */
  compact?: boolean;
  onUpdated?: (report: FloodReport) => void;
}) {
  const [phase, setPhase] = useState<Phase>("asking");
  const [message, setMessage] = useState<string | null>(null);
  const headingId = useId();

  const prompt = getFollowUpPrompt(report.floodDepth);
  const current = getFloodDepthOption(report.floodDepth);

  async function submit(floodDepth: FloodDepthCode) {
    setPhase("sending");
    try {
      const res = await fetch(`/api/reports/${report.id}/follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ floodDepth }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhase("error");
        setMessage(data.error ?? "Hindi na-save ang update.");
        return;
      }
      setPhase("done");
      if (data.report) onUpdated?.(data.report);
    } catch {
      setPhase("error");
      setMessage("Mukhang offline ka. Subukan ulit.");
    }
  }

  function handleNo() {
    if (prompt.noOutcome.kind === "DISMISS") {
      // Nothing is written. "Still no flood" is what the standing report
      // already says, so recording it would inflate the data without
      // adding information.
      setPhase("dismissed");
      return;
    }
    void submit(prompt.noOutcome.depth);
  }

  const text = compact ? "text-[11px]" : "text-xs";
  const buttonBase = compact
    ? "inline-flex min-h-9 items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold"
    : "inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-xs font-semibold";

  if (phase === "done") {
    return (
      <p aria-live="polite" className={`flex items-center gap-1.5 text-(--color-ink-muted) ${text}`}>
        <Check className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden="true" />
        Salamat! Naitala ang update mo.
      </p>
    );
  }

  if (phase === "dismissed") {
    return (
      <p aria-live="polite" className={`text-(--color-ink-muted) ${text}`}>
        Salamat. Nanatiling <strong className="font-semibold">{current.label}</strong> ang report
        dito.
      </p>
    );
  }

  if (phase === "picking") {
    const choices = getFollowUpDepthChoices(report.floodDepth);
    return (
      <fieldset disabled={false} className="space-y-2">
        <legend className={`text-(--color-ink-muted) ${text}`}>
          Gaano kalalim ngayon?{" "}
          <span className="text-(--color-ink-faint)">
            (kasalukuyang report: {current.label})
          </span>
        </legend>
        <div className={`grid gap-1.5 ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
          {choices.map(({ option, disabled, disabledReason }) => (
            <button
              key={option.code}
              type="button"
              disabled={disabled}
              // Disabled options stay visible so the user can see what the
              // standing report says. aria-disabled is not used here — a
              // genuinely unavailable choice should be skipped by the
              // keyboard, not announced and then rejected.
              onClick={() => void submit(option.code)}
              className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-3 focus-visible:outline-(--color-brand) ${
                disabled
                  ? "cursor-not-allowed border-(--color-border) bg-(--color-paper) opacity-60"
                  : "border-(--color-border-strong) bg-(--color-surface) hover:bg-(--color-paper)"
              }`}
            >
              <DepthIcon code={option.code} className="h-6 w-6 shrink-0" />
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-(--color-ink)">
                  {option.label}
                </span>
                {disabledReason && (
                  <span className="block text-[11px] text-(--color-ink-faint)">
                    {disabledReason}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPhase("asking")}
          // min-h-11, not the bare text size: this is a standalone
          // control on its own line, so the WCAG 2.5.8 inline-text
          // exception does not cover it.
          className={`${text} inline-flex min-h-11 items-center text-(--color-ink-muted) underline underline-offset-2`}
        >
          Bumalik
        </button>
      </fieldset>
    );
  }

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <div className="flex flex-wrap items-center gap-2">
        <span id={headingId} className={`text-(--color-ink-muted) ${text}`}>
          {prompt.question}
          {/* The question alone is ambiguous read out of context, so the
              full sentence is available to screen readers. */}
          <span className="sr-only"> {prompt.accessibleContext}</span>
        </span>
        <div role="group" aria-labelledby={headingId} className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={phase === "sending"}
            onClick={() => setPhase("picking")}
            className={`${buttonBase} border-(--color-border-strong) text-(--color-ink) hover:bg-(--color-paper) disabled:opacity-50`}
          >
            {prompt.yesLabel}
          </button>
          <button
            type="button"
            disabled={phase === "sending"}
            onClick={handleNo}
            className={`${buttonBase} border-(--color-border-strong) text-(--color-ink) hover:bg-(--color-paper) disabled:opacity-50`}
          >
            {prompt.noLabel}
          </button>
        </div>
      </div>

      {phase === "error" && message && (
        <p role="alert" className={`text-(--color-danger) ${text}`}>
          {message}
        </p>
      )}
    </div>
  );
}
