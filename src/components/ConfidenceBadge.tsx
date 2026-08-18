import type { ConfidenceResult } from "@/lib/types";

const LABELS: Record<ConfidenceResult["level"], string> = {
  HIGH: "High confidence",
  MEDIUM: "Medium confidence",
  LOW: "Low confidence",
  NONE: "",
};

export function ConfidenceBadge({ confidence }: { confidence: ConfidenceResult }) {
  if (confidence.level === "NONE") return null;

  const count = confidence.agreeingReportCount;
  const reportWord = count === 1 ? "report" : "reports";

  return (
    <p className="text-sm text-(--color-ink-muted)">
      <span className="font-medium text-(--color-ink)">{LABELS[confidence.level]}</span>
      {" · "}
      {count} {reportWord}
    </p>
  );
}
