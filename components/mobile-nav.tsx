"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { BrandMark } from "@/components/brand-mark";
import { brandName } from "@/lib/brand";

interface MobileNavProps {
  userEmail?: string;
  onLogout?: () => void;
  /** Kept for API compatibility; navigation lives in MobileBottomNav. */
  userRole?: string;
}

/**
 * Mobile top bar: brand + account. Navigation is handled entirely by
 * MobileBottomNav (it already lists every section), so there's no hamburger
 * drawer — it would duplicate the bottom nav.
 */
export function MobileNav({ userEmail, onLogout }: MobileNavProps) {
  const t = useTranslations("Nav");
  const locale = useLocale();
  const firstLetter = userEmail ? userEmail.charAt(0).toUpperCase() : "?";

  return (
    <header className="lg:hidden bg-sidebar shadow-sm sticky top-0 z-40">
      <div className="px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-accent to-accent/80 rounded-lg flex items-center justify-center">
            <BrandMark className="h-5 w-5 text-sidebar" />
          </div>
          <h1 className="text-xl font-bold text-sidebar-foreground">{brandName(locale)}</h1>
        </Link>

        {/* Account */}
        <div className="flex items-center gap-2">
          {userEmail && (
            <div className="w-8 h-8 bg-accent text-sidebar rounded-full flex items-center justify-center font-bold text-sm">
              {firstLetter}
            </div>
          )}
          {onLogout && (
            <button
              onClick={onLogout}
              aria-label={t("logout")}
              className="min-h-[44px] min-w-[44px] p-2 text-sm text-sidebar-foreground/80 hover:text-sidebar-foreground"
            >
              {t("logout")}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
