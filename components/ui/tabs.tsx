"use client";

import type { ReactNode } from "react";
import { useRef } from "react";

export interface TabItem {
  /** Stable key returned via onChange and compared against `active`. */
  key: string;
  label: ReactNode;
  /** Optional count rendered as a muted figure after the label. */
  count?: number;
}

interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  /** Accessible name for the tablist. */
  ariaLabel?: string;
  className?: string;
}

/**
 * App-wide segmented-control tabs. One source of truth so every tabbed screen
 * looks identical: a subtle surface track with a filled accent pill on the
 * active tab. Scrolls horizontally on overflow (mobile) instead of wrapping to
 * a second row. Left/Right arrow keys move between tabs (roving selection).
 *
 * Cosmetic styling lives ONLY here — there is no global `[role="tab"]` rule
 * (see app/[locale]/accessibility.css). Use design tokens, never raw colors,
 * so the control re-themes with the 12 account themes.
 */
export function Tabs({ tabs, active, onChange, ariaLabel, className = "" }: TabsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusTab = (index: number) => {
    const next = (index + tabs.length) % tabs.length;
    const el = refs.current[next];
    el?.focus();
    onChange(tabs[next].key);
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex gap-1 overflow-x-auto rounded-[var(--radius)] border border-border bg-surface p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {tabs.map((tab, i) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={(e) => {
              // RTL-agnostic: ArrowRight always = next in array, ArrowLeft = prev.
              if (e.key === "ArrowRight") {
                e.preventDefault();
                focusTab(i + 1);
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                focusTab(i - 1);
              }
            }}
            className={`min-h-[40px] flex-1 whitespace-nowrap rounded-[calc(var(--radius)-2px)] px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ms-1.5 tabular-nums opacity-70">{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
