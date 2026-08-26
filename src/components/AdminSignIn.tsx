"use client";

import { useState } from "react";

/**
 * Shared moderator passcode form.
 *
 * Both admin surfaces need it, and sending someone from one page to the
 * other to sign in would strand them on the wrong page afterwards. Kept
 * in one place so the two never drift — in particular so a change to the
 * error copy or the input's contrast applies to both.
 *
 * `onSignedIn` lets the host page reload its own data rather than doing
 * a full navigation, so the moderator lands exactly where they started.
 */
export function AdminSignIn({
  title = "Moderator sign-in",
  onSignedIn,
}: {
  title?: string;
  onSignedIn: () => void;
}) {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Mali ang passcode.");
        return;
      }
      setPasscode("");
      onSignedIn();
    } catch {
      setError("Mukhang offline ka. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <h1 className="text-xl font-bold text-(--color-ink)">{title}</h1>
      <p className="mt-1 text-sm text-(--color-ink-muted)">
        Ang page na ito ay para sa mga moderator lamang.
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-3">
        <label htmlFor="passcode" className="block text-sm font-medium text-(--color-ink)">
          Passcode
        </label>
        <input
          id="passcode"
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          // border-strong, not border: this is an interactive control, so
          // WCAG 1.4.11 wants 3:1 against the page, not the 1.5:1 that the
          // decorative divider token gives.
          className="min-h-11 w-full rounded-xl border border-(--color-border-strong) bg-(--color-surface) px-4 py-2.5 text-sm text-(--color-ink)"
          autoFocus
        />
        {error && (
          <p role="alert" className="text-sm text-(--color-danger)">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 w-full rounded-full bg-(--color-brand) px-4 py-2.5 text-sm font-semibold text-(--color-brand-ink) hover:bg-(--color-brand-hover) disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
