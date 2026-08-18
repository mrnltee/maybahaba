const STORAGE_KEY = "mbb_device_id";

/**
 * A stable per-browser identifier used only to stop one person voting
 * twice on the same report.
 *
 * This is not analytics and not a tracking id: it never leaves the
 * device except as part of a confirmation request, and the server hashes
 * it (together with the connection) before storing it. Losing it — via
 * cleared storage or private browsing — costs the user nothing beyond
 * the ability to re-vote on a report they already confirmed.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const generated = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, generated);
    return generated;
  } catch {
    // Storage can be unavailable (private mode, blocked cookies). Fall
    // back to a per-session id so confirming still works; the server-side
    // rate limit remains the backstop.
    return crypto.randomUUID();
  }
}

const VOTED_KEY = "mbb_voted_reports";

/** Report ids this browser has already confirmed, for instant UI feedback. */
export function getVotedReportIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(VOTED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/** Fired locally when this tab records a vote, so subscribers re-read. */
const VOTE_EVENT = "mbb:voted";

export function markReportVoted(reportId: string): void {
  if (typeof window === "undefined") return;
  try {
    const ids = getVotedReportIds();
    ids.add(reportId);
    window.localStorage.setItem(VOTED_KEY, JSON.stringify([...ids]));
  } catch {
    // Non-fatal — the server still enforces one vote per report.
  }
  // `storage` only fires in *other* tabs, so announce it in this one too.
  window.dispatchEvent(new Event(VOTE_EVENT));
}

/**
 * Subscribe to changes in the voted-reports set. Used with
 * `useSyncExternalStore` so components read this browser-local state
 * without a setState-in-effect, and stay correct across tabs.
 */
export function subscribeToVotes(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onChange);
  window.addEventListener(VOTE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(VOTE_EVENT, onChange);
  };
}

export function hasVotedOnReport(reportId: string): boolean {
  return getVotedReportIds().has(reportId);
}
