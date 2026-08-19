"use client";

import { ChevronDown, ExternalLink, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * The header's "Report Baha" control.
 *
 * It's a plain button for the public and a small menu for signed-in
 * moderators. The admin entry point is revealed only when a valid
 * moderator session already exists — the brief (section 39) is explicit
 * that administrative functions must not be exposed through the public
 * interface, and a permanently visible "Admin" link would advertise the
 * moderation surface to everyone. Moderators who aren't signed in still
 * reach it by going to /admin/validate directly.
 */
export function Header({ onReportClick }: { onReportClick: () => void }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/session")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setIsAdmin(Boolean(d.isAdmin));
      })
      .catch(() => {
        // Not being able to check simply means "treat as public".
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-(--color-border) bg-(--color-paper)/95">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold tracking-tight text-(--color-ink)"
        >
          {/* The mark is decorative here — the wordmark beside it already
              names the app, so announcing both would just repeat it. */}
          <Image
            src="/logo-mark.svg"
            alt=""
            width={32}
            height={32}
            priority
            className="h-8 w-8 shrink-0"
            aria-hidden="true"
          />
          {/* One flex child, not two text nodes: the container's gap-2 was
              landing between "MayBaha" and "Ba" and splitting the wordmark. */}
          <span>
            MayBaha<span className="text-(--color-brand)">Ba</span>
          </span>
        </Link>

        <div ref={containerRef} className="relative flex items-center">
          <button
            type="button"
            onClick={onReportClick}
            className={`inline-flex min-h-11 items-center bg-(--color-brand) px-4 py-2 text-sm font-semibold text-(--color-brand-ink) transition-colors hover:bg-(--color-brand-hover) focus-visible:outline-3 focus-visible:outline-(--color-brand) ${
              isAdmin ? "rounded-l-full" : "rounded-full"
            }`}
          >
            Report Baha
          </button>

          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Iba pang aksyon"
                className="inline-flex min-h-11 items-center rounded-r-full border-l border-(--color-brand-ink)/25 bg-(--color-brand) px-2.5 py-2 text-(--color-brand-ink) hover:bg-(--color-brand-hover) focus-visible:outline-3 focus-visible:outline-(--color-brand)"
              >
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-40 mt-1 w-56 overflow-hidden rounded-xl border border-(--color-border) bg-(--color-surface) py-1 shadow-lg"
                >
                  <Link
                    href="/admin/reports"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-11 items-center gap-2 px-4 py-2 text-sm text-(--color-ink) hover:bg-(--color-paper)"
                  >
                    <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Lahat ng reports
                  </Link>
                  <Link
                    href="/admin/validate"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-11 items-center gap-2 px-4 py-2 text-sm text-(--color-ink) hover:bg-(--color-paper)"
                  >
                    <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                    I-validate ang reports
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
