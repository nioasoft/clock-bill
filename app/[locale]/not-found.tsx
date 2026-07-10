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
            <h1 className="text-9xl font-bold text-primary opacity-20">404</h1>
            <div className="absolute inset-0 flex items-center justify-center">
              <Search className="w-20 h-20 text-primary" />
            </div>
          </div>

          {/* Error Message */}
          <h2 className="text-2xl font-bold text-foreground mb-2">{t("title")}</h2>
          <p className="text-muted-foreground mb-8">{t("description")}</p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-[var(--radius)] hover:bg-primary/90 transition-colors font-medium"
            >
              <Home className="w-5 h-5" />
              {t("backToDashboard")}
            </Link>
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-card text-foreground rounded-[var(--radius)] hover:bg-muted transition-colors font-medium border border-border"
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
                  {i > 0 && <span className="text-border">•</span>}
                  <Link
                    href={s.href}
                    className="px-4 py-2 text-sm text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
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
