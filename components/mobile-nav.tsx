"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { Play } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { brandName } from "@/lib/brand";
import { useTimer } from "@/contexts/timer-context";

interface MobileNavProps {
  userEmail?: string;
  /** Kept for API compatibility; navigation lives in MobileBottomNav. */
  userRole?: string;
}

/**
 * Mobile top bar: brand + primary "start timer" action + account.
 *
 * The bar is sticky, so the timer button here is ALWAYS reachable while never
 * floating over page content (it replaced the old floating FAB, which kept
 * covering form fields). The avatar links to Settings, where logout now lives —
 * logout was removed from the top bar (it doesn't belong as a top-level action).
 * Section navigation is handled entirely by MobileBottomNav.
 */
export function MobileNav({ userEmail }: MobileNavProps) {
  const t = useTranslations("Timer");
  const tNav = useTranslations("Nav");
  const locale = useLocale();
  const { setShowTimerModal } = useTimer();
  const firstLetter = userEmail ? userEmail.charAt(0).toUpperCase() : "?";

  return (
    <header className="lg:hidden bg-sidebar shadow-sm sticky top-0 z-40">
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 bg-gradient-to-br from-accent to-accent/80 rounded-lg flex items-center justify-center shrink-0">
            <BrandMark className="h-5 w-5 text-sidebar" />
          </div>
          <h1 className="text-xl font-bold text-sidebar-foreground truncate">{brandName(locale)}</h1>
        </Link>

        {/* Primary action + account */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowTimerModal(true)}
            aria-label={t("bar.startTimer")}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent/90 active:scale-95 transition-all"
          >
            <Play className="h-4 w-4 fill-current" />
            {t("bar.startTimer")}
          </button>
          {userEmail && (
            <Link
              href="/settings"
              aria-label={tNav("settings")}
              className="w-9 h-9 bg-sidebar-foreground/10 text-sidebar-foreground rounded-full flex items-center justify-center font-bold text-sm shrink-0 hover:bg-sidebar-foreground/15 transition-colors"
            >
              {firstLetter}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
