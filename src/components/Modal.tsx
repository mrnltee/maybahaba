"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  titleId: string;
  title: string;
  children: React.ReactNode;
}

/** Accessible modal shell: focus trap, ESC to close, aria-modal, restores focus on close. */
export function Modal({ open, onClose, titleId, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  /**
   * Callers pass `onClose` as an inline arrow, so its identity changes on
   * every parent render. Holding it in a ref keeps it out of the effect's
   * dependency list.
   *
   * This was a real bug, not a micro-optimisation: with `onClose` in the
   * deps, typing one character in the reporter-name field re-rendered the
   * parent, re-ran this effect, and called `dialogRef.focus()` — stealing
   * focus from the input after every single keystroke.
   */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    dialogRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key === "Tab") {
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      previouslyFocused.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-(--color-surface) p-6 shadow-xl sm:max-w-lg sm:rounded-2xl sm:p-8"
      >
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-bold text-(--color-ink)">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Isara"
            className="rounded-full p-1.5 text-(--color-ink-faint) hover:bg-(--color-paper) hover:text-(--color-ink)"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
