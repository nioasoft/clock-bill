"use client";

import { useRef } from "react";
import { Calendar } from "lucide-react";

interface MonthFieldProps {
  /** Month value as "YYYY-MM" (matches a native <input type="month">). */
  value: string;
  onChange: (value: string) => void;
  /** "he" | "en" — controls the displayed month-name formatting. */
  locale?: string;
  id?: string;
  /** Extra classes on the wrapper (e.g. "w-full"). */
  className?: string;
  ariaLabel?: string;
}

/**
 * Month picker with a styled, RTL-correct trigger. The native
 * <input type="month"> renders its value LTR ("June 2026") with a fixed-side
 * calendar glyph, which clashes with the app's custom selects in a Hebrew/RTL
 * layout. Here the trigger shows a locale-formatted label ("יוני 2026") and the
 * real input — kept functional for `showPicker()` — is layered invisibly so the
 * platform month popup still anchors to it. Tokens only, so it re-themes.
 */
export function MonthField({ value, onChange, locale = "he", id, className = "", ariaLabel }: MonthFieldProps) {
  const ref = useRef<HTMLInputElement>(null);

  const label = formatMonth(value, locale);

  const open = () => {
    const el = ref.current;
    if (!el) return;
    // showPicker() must run from a user gesture (this onClick qualifies).
    if (typeof el.showPicker === "function") {
      try {
        el.showPicker();
        return;
      } catch {
        // Fall through to focus on engines that reject showPicker here.
      }
    }
    el.focus();
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        id={id}
        onClick={open}
        aria-label={ariaLabel}
        className="inline-flex h-11 w-full touch-manipulation items-center justify-between gap-2 rounded-[var(--radius)] border border-border bg-background px-3 text-sm text-foreground tabular-nums transition-[background-color,border-color,box-shadow] hover:border-border-strong hover:bg-muted/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
      >
        <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </button>
      <input
        ref={ref}
        type="month"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
      />
    </div>
  );
}

function formatMonth(value: string, locale: string): string {
  const [y, m] = value.split("-").map(Number);
  if (!y || !m) return "—";
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "he-IL", {
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, 1));
}
