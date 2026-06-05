"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/src/i18n/navigation";
import { routing, type Locale } from "@/src/i18n/routing";

interface LocaleSwitcherProps {
  /** When collapsed, render a single compact toggle instead of two buttons. */
  isCollapsed?: boolean;
  className?: string;
}

/**
 * He/En locale switcher. Replaces the current route under the chosen locale
 * (next-intl preserves the path), so the user stays on the same screen.
 */
export function LocaleSwitcher({ isCollapsed = false, className = "" }: LocaleSwitcherProps) {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const switchTo = (next: Locale) => {
    if (next === locale) return;
    // Preserve the current path; next-intl swaps the locale prefix for us.
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  };

  // Collapsed: a single tap target toggling between the two locales.
  if (isCollapsed) {
    const next: Locale = locale === "he" ? "en" : "he";
    return (
      <button
        type="button"
        onClick={() => switchTo(next)}
        disabled={isPending}
        title={t("label")}
        aria-label={t("label")}
        className={`flex h-11 w-full items-center justify-center rounded-[var(--radius)] text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50 ${className}`}
      >
        {locale === "he" ? "EN" : "עב"}
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label={t("label")}
      className={`flex items-center gap-1 rounded-[var(--radius)] border border-border p-1 ${className}`}
    >
      {routing.locales.map((loc) => {
        const isActive = loc === locale;
        return (
          <button
            key={loc}
            type="button"
            onClick={() => switchTo(loc)}
            disabled={isPending}
            aria-pressed={isActive}
            className={`min-h-11 flex-1 rounded-[var(--radius)] px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(loc)}
          </button>
        );
      })}
    </div>
  );
}
