"use client";

import { useTransition } from "react";
import { Globe } from "lucide-react";
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
    // Persist the choice to the profile so it survives cookie loss / a new
    // device (and drives transactional-email language). Fire-and-forget: on
    // public/unauthenticated pages this returns 401 — we swallow it and never
    // block the UI on the request.
    void fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    }).catch(() => {});
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
        className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-[var(--radius)] border border-border bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50 ${className}`}
      >
        <Globe className="h-4 w-4" />
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
