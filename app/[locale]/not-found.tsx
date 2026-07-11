"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { Home, Search } from "lucide-react";

/**
 * Localized 404. Rendered inside the [locale] layout (so it gets globals.css,
 * fonts and the theme) via the `[...rest]` catch-all route that calls
 * `notFound()` for any unmatched path.
 */
export default function NotFound() {
  const t = useTranslations("NotFound");
  const tNav = useTranslations("Nav");

  const suggestions = [
    { href: "/entries", label: tNav("entries") },
    { href: "/clients", label: tNav("clients") },
    { href: "/tasks", label: tNav("tasks") },
    { href: "/reports", label: tNav("reports") },
  ] as const;

  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="max-w-md w-full">
        <div className="text-center">
          {/* 404 Number */}
          <div className="mb-6 relative">
            <div className="text-9xl font-bold text-primary opacity-20" aria-hidden="true">404</div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Search className="h-20 w-20 text-primary" aria-hidden="true" />
            </div>
          </div>

          {/* Error Message */}
          <h1 className="mb-2 text-balance text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="mb-8 text-pretty text-muted-foreground">{t("description")}</p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-[var(--radius)] hover:bg-primary/90 transition-colors font-medium"
            >
              <Home className="h-5 w-5" aria-hidden="true" />
              {t("backToDashboard")}
            </Link>
            <button
              onClick={() => window.history.back()}
              className="inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-[var(--radius)] border border-border bg-card px-6 py-3 font-medium text-foreground transition-colors hover:bg-muted"
            >
              {t("goBack")}
            </button>
          </div>

          {/* Helpful Links */}
          <div className="mt-12 pt-8 border-t border-border">
            <p className="text-sm text-muted-foreground mb-4">{t("maybeYouMeant")}</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestions.map((s, i) => (
                <span key={s.href} className="inline-flex items-center gap-2">
                  {i > 0 && <span className="text-border" aria-hidden="true">•</span>}
                  <Link
                    href={s.href}
                    className="inline-flex min-h-11 touch-manipulation items-center rounded-[var(--radius)] px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    {s.label}
                  </Link>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
