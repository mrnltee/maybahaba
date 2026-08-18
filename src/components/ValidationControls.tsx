"use client";

import { getDeviceId, hasVotedOnReport, markReportVoted, subscribeToVotes } from "@/lib/deviceId";
import type { CommunityAction, FloodReport } from "@/lib/types";
import { Check, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

interface ValidationControlsProps {
  report: FloodReport;
  /** Compact styling for use inside a Leaflet map popup. */
  compact?: boolean;
  onVoted?: (updated: FloodReport) => void;
}

type VoteState = "idle" | "sending" | "done" | "already" | "error";

/**
 * Public community validation (spec section 16).
 *
 * Two independent questions, shown as separate rows because they mean
 * different things — a report can be accurate but no longer current.
 * Both are optional and require no account.
 *
 * Accessibility: each row is a labelled group, buttons carry explicit
 * text (not icon-only), and the resulting state is announced via
 * aria-live rather than being conveyed by colour alone.
 */
export function ValidationControls({ report, compact = false, onVoted }: ValidationControlsProps) {
  const [state, setState] = useState<VoteState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  /**
   * Whether this browser already voted on this report. Read via
   * useSyncExternalStore rather than an effect: localStorage is external
   * state, the server snapshot is `false` so SSR and first client render
   * agree (no hydration mismatch), and the value stays correct if the
   * user votes in another tab.
   */
  const alreadyVotedLocally = useSyncExternalStore(
    subscribeToVotes,
    () => hasVotedOnReport(report.id),
    () => false
  );

  async function vote(action: CommunityAction) {
    setState("sending");
    try {
      const res = await fetch(`/api/reports/${report.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, deviceId: getDeviceId() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setState("error");
        setMessage(data.error ?? "Hindi na-save ang confirmation.");
        return;
      }

      markReportVoted(report.id);

      if (data.alreadyVoted) {
        setState("already");
        setMessage(data.message);
        return;
      }

      setState("done");
      if (data.report) onVoted?.(data.report);
    } catch {
      setState("error");
      setMessage("Mukhang offline ka. Subukan ulit.");
    }
  }

  const disabled = state === "sending";
  const settled = state === "done" || state === "already" || alreadyVotedLocally;

  // WCAG 2.2 AA (2.5.8) only requires 24x24, which the old sizes met.
  // These are bigger anyway: the target user is tapping one-handed,
  // outdoors, possibly in the rain (spec section 25).
  const buttonBase = compact
    ? "inline-flex min-h-9 items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold"
    : "inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-xs font-semibold";

  if (settled) {
    return (
      <p
        aria-live="polite"
        className={`flex items-center gap-1.5 text-(--color-ink-muted) ${compact ? "text-[11px]" : "text-xs"}`}
      >
        <Check className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden="true" />
        {state === "already" ? (message ?? "Nakapag-confirm ka na.") : "Salamat! Naitala ang sagot mo."}
      </p>
    );
  }

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2.5"}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          id={`currency-${report.id}`}
          className={`text-(--color-ink-muted) ${compact ? "text-[11px]" : "text-xs"}`}
        >
          Baha pa rin ba?
        </span>
        <div role="group" aria-labelledby={`currency-${report.id}`} className="flex gap-1.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => vote("STILL_FLOODED")}
            className={`${buttonBase} border-(--color-border-strong) text-(--color-ink) hover:bg-(--color-paper) disabled:opacity-50`}
          >
            Oo, may baha pa
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => vote("NO_LONGER_FLOODED")}
            className={`${buttonBase} border-(--color-border-strong) text-(--color-ink) hover:bg-(--color-paper) disabled:opacity-50`}
          >
            Wala na
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          id={`accuracy-${report.id}`}
          className={`text-(--color-ink-muted) ${compact ? "text-[11px]" : "text-xs"}`}
        >
          Tama ba ang report na ito?
        </span>
        <div role="group" aria-labelledby={`accuracy-${report.id}`} className="flex gap-1.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => vote("ACCURATE")}
            aria-label="Tama ang report na ito"
            className={`${buttonBase} gap-1 border-(--color-border-strong) text-(--color-ink) hover:bg-(--color-paper) disabled:opacity-50`}
          >
            <Check className="h-3 w-3" aria-hidden="true" />
            Tama
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => vote("INACCURATE")}
            aria-label="Mali ang report na ito"
            className={`${buttonBase} gap-1 border-(--color-border-strong) text-(--color-ink) hover:bg-(--color-paper) disabled:opacity-50`}
          >
            <X className="h-3 w-3" aria-hidden="true" />
            Mali
          </button>
        </div>
      </div>

      {state === "error" && message && (
        <p role="alert" className={`text-(--color-danger) ${compact ? "text-[11px]" : "text-xs"}`}>
          {message}
        </p>
      )}
    </div>
  );
}

/**
 * Read-only summary of what the community has said about a report.
 * Shown alongside the confidence tier so a "wala na" signal is visible
 * even though it deliberately does not flip the headline status.
 */
export function CommunitySignals({ report }: { report: FloodReport }) {
  const parts: string[] = [];
  if (report.stillFloodedCount > 0) {
    parts.push(`${report.stillFloodedCount} kumpirmang may baha pa`);
  }
  if (report.noLongerFloodedCount > 0) {
    parts.push(`${report.noLongerFloodedCount} nagsabing wala na`);
  }
  if (report.inaccurateCount > 0) {
    parts.push(`${report.inaccurateCount} nagsabing mali`);
  }
  if (parts.length === 0) return null;

  return <p className="text-xs text-(--color-ink-faint)">{parts.join(" · ")}</p>;
}
