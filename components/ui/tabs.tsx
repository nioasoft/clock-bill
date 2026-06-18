"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

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
 * active tab. Left/Right arrow keys move between tabs (roving selection).
 *
 * When the tabs don't fit (e.g. 6 settings tabs on a phone) the track scrolls
 * horizontally instead of wrapping — and the edges get a soft fade mask so a
 * partially-visible tab reads as "scroll for more" rather than a hard clip.
 * Selecting a tab scrolls it fully into view.
 *
 * Cosmetic styling lives ONLY here — there is no global `[role="tab"]` rule
 * (see app/[locale]/accessibility.css). Use design tokens, never raw colors,
 * so the control re-themes with the 12 account themes.
 */
export function Tabs({ tabs, active, onChange, ariaLabel, className = "" }: TabsProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [overflowing, setOverflowing] = useState(false);

  // Detect whether the tabs overflow their track, so the fade mask only applies
  // when there's actually hidden content to scroll to.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollWidth > el.clientWidth + 2);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tabs.length]);

  // Keep the active tab fully visible (e.g. when a clipped tab is selected).
  useEffect(() => {
    const i = tabs.findIndex((t) => t.key === active);
    refs.current[i]?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [active, tabs]);

  const focusTab = (index: number) => {
    const next = (index + tabs.length) % tabs.length;
    const el = refs.current[next];
    el?.focus();
    onChange(tabs[next].key);
  };

  return (
    <div
      ref={trackRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`flex w-fit max-w-full gap-1 overflow-x-auto rounded-[var(--radius)] border border-border bg-surface p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
        overflowing
          ? "[mask-image:linear-gradient(to_right,transparent,#000_1.25rem,#000_calc(100%-1.25rem),transparent)]"
          : ""
      } ${className}`}
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
            className={`min-h-[40px] whitespace-nowrap rounded-[calc(var(--radius)-2px)] px-4 py-2 text-sm font-medium transition-colors ${
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
