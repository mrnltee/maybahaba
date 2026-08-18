"use client";

import Link from "next/link";

export function Header({ onReportClick }: { onReportClick: () => void }) {
  return (
    <header className="border-b border-(--color-border) bg-(--color-paper)/95 backdrop-blur-none sticky top-0 z-30">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-(--color-ink)">
          MayBaha<span className="text-(--color-brand)">Ba</span>
        </Link>
        <button
          type="button"
          onClick={onReportClick}
          className="inline-flex items-center rounded-full bg-(--color-brand) px-4 py-2 text-sm font-semibold text-(--color-brand-ink) transition-colors hover:bg-(--color-brand-hover) focus-visible:outline-3 focus-visible:outline-(--color-brand)"
        >
          Report Baha
        </button>
      </div>
    </header>
  );
}
