"use client";

import { useDebounce } from "@/hooks/useDebounce";
import type { LocationResult } from "@/lib/types";
import { Loader2, MapPin, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

interface SearchBoxProps {
  placeholder?: string;
  onSelect: (location: LocationResult) => void;
  autoFocus?: boolean;
  initialValue?: string;
}

export function SearchBox({ placeholder = "Enter a location...", onSelect, autoFocus, initialValue = "" }: SearchBoxProps) {
  const [query, setQuery] = useState(initialValue);
  const [results, setResults] = useState<LocationResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debouncedQuery = useDebounce(query, 300);
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  const trimmedQuery = debouncedQuery.trim();
  const queryTooShort = trimmedQuery.length < 2;

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    // Nothing to fetch — bail out without touching state. Stale
    // results/error from a previous longer query are simply not
    // rendered while `queryTooShort` is true (see JSX below), so there's
    // no need to clear them here.
    if (trimmed.length < 2) return;

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    fetch(`/api/search?q=${encodeURIComponent(trimmed)}`)
      .then((res) => res.json())
      .then((data: { results?: LocationResult[]; error?: string }) => {
        if (requestId !== requestIdRef.current) return;
        if (data.error) {
          setError(data.error);
          setResults([]);
        } else {
          setResults(data.results ?? []);
        }
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return;
        setError("Mukhang offline ka. Check your connection and try again.");
        setResults([]);
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setLoading(false);
      });
  }, [debouncedQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectResult(result: LocationResult) {
    setQuery(result.label);
    setOpen(false);
    setActiveIndex(-1);
    onSelect(result);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      selectResult(results[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-(--color-ink-faint)"
          aria-hidden="true"
        />
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-label="Search a location"
          autoFocus={autoFocus}
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => !queryTooShort && results.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full rounded-2xl border border-(--color-border) bg-(--color-surface) py-4 pl-12 pr-12 text-base text-(--color-ink) placeholder:text-(--color-ink-faint) shadow-sm focus:border-(--color-brand) focus-visible:outline-3 focus-visible:outline-(--color-brand)"
        />
        {loading && !queryTooShort && (
          <Loader2
            className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-(--color-ink-faint)"
            aria-hidden="true"
          />
        )}
      </div>

      {open && !queryTooShort && (results.length > 0 || error) && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-40 mt-2 max-h-80 w-full overflow-auto rounded-xl border border-(--color-border) bg-(--color-surface) py-1 shadow-lg"
        >
          {error && (
            <li className="px-4 py-3 text-sm text-(--color-danger)" role="status">
              {error}
            </li>
          )}
          {!error &&
            results.map((result, index) => (
              <li key={result.id} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectResult(result)}
                  className={`flex w-full items-start gap-3 px-4 py-3 text-left text-sm hover:bg-(--color-paper) ${
                    index === activeIndex ? "bg-(--color-paper)" : ""
                  }`}
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-(--color-ink-faint)" aria-hidden="true" />
                  <span className="text-(--color-ink)">{result.label}</span>
                </button>
              </li>
            ))}
        </ul>
      )}

      {open && !queryTooShort && !loading && !error && results.length === 0 && (
        <div className="absolute z-40 mt-2 w-full rounded-xl border border-(--color-border) bg-(--color-surface) px-4 py-3 text-sm text-(--color-ink-muted) shadow-lg">
          Hindi namin makita ang lugar.
        </div>
      )}
    </div>
  );
}
