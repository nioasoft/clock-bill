"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { Play } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { brandName } from "@/lib/brand";
import { useTimer } from "@/contexts/timer-context";
import { MobileAccountMenu } from "@/components/mobile-account-menu";

interface MobileNavProps {
  userEmail?: string;
  userName?: string | null;
  /** Kept for API compatibility; navigation lives in MobileBottomNav. */
  userRole?: string;
}

/**
 * Mobile top bar: brand + primary "start timer" action + account.
 *
 * The bar is sticky, so the timer button here is ALWAYS reachable while never
 * floating over page content (it replaced the old floating FAB, which kept
 * covering form fields). The avatar opens an account sheet (MobileAccountMenu)
 * with clients, settlement, settings and logout — the two sections pulled off
 * the bottom nav to keep it minimal. Primary section nav is MobileBottomNav.
 */
export function MobileNav({ userEmail, userName }: MobileNavProps) {
  const t = useTranslations("Timer");
  const locale = useLocale();
  const { setShowTimerModal } = useTimer();

  return (
    <header className="lg:hidden bg-sidebar sticky top-0 z-40">
      <div className="flex min-h-16 items-center justify-between gap-2 px-4 py-2">
        {/* Logo */}
        <Link href="/" className="flex min-h-11 min-w-0 touch-manipulation items-center gap-2 rounded-[var(--radius)]">
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
            className="inline-flex min-h-11 touch-manipulation items-center gap-1.5 rounded-full border border-accent/80 bg-accent px-3.5 py-2 text-sm font-semibold text-accent-foreground shadow-sm transition-[background-color,border-color,transform] hover:bg-accent/90 active:scale-[0.98] motion-reduce:active:scale-100"
          >
            <Play className="h-4 w-4 fill-current" aria-hidden="true" />
            {t("bar.startTimer")}
          </button>
          {userEmail && (
            <MobileAccountMenu userEmail={userEmail} userName={userName} />
          )}
        </div>
      </div>
    </header>
  );
}
