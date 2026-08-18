import { STATUS_COPY } from "@/lib/status";
import type { MayBahaStatus } from "@/lib/types";
import { AlertTriangle, CircleHelp, CircleSlash, Droplets, ShieldCheck, TriangleAlert } from "lucide-react";

const TONE_STYLES: Record<
  "neutral" | "safe" | "warning" | "danger",
  { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }
> = {
  neutral: { bg: "bg-(--color-neutral-status-bg)", text: "text-(--color-neutral-status)", icon: CircleHelp },
  safe: { bg: "bg-(--color-safe-bg)", text: "text-(--color-safe)", icon: ShieldCheck },
  warning: { bg: "bg-(--color-warn-bg)", text: "text-(--color-warn)", icon: Droplets },
  danger: { bg: "bg-(--color-danger-bg)", text: "text-(--color-danger)", icon: TriangleAlert },
};

export function StatusBadge({ status, size = "md" }: { status: MayBahaStatus; size?: "sm" | "md" }) {
  const copy = STATUS_COPY[status];
  const tone = TONE_STYLES[copy.tone];
  const Icon = tone.icon;
  const sizeClasses = size === "sm" ? "text-xs px-2.5 py-1 gap-1.5" : "text-sm px-3 py-1.5 gap-2";

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${tone.bg} ${tone.text} ${sizeClasses}`}
    >
      <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden="true" />
      {copy.headline}
    </span>
  );
}

export function RoadImpassableIcon({ className }: { className?: string }) {
  return <CircleSlash className={className} aria-hidden="true" />;
}

export function AlertIcon({ className }: { className?: string }) {
  return <AlertTriangle className={className} aria-hidden="true" />;
}
