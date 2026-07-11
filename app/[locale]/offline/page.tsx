import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Offline");
  return {
    title: t("metaTitle"),
  };
}

/**
 * Offline fallback shown by the service worker when a navigation fails and the
 * page isn't cached. Intentionally static and dependency-free.
 */
export default async function OfflinePage() {
  const t = await getTranslations("Offline");

  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="mb-6 h-1 w-12 rounded-full bg-primary" aria-hidden="true" />
      <h1 className="text-balance font-display text-3xl font-bold text-foreground">{t("title")}</h1>
      <p className="mt-3 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">{t("body")}</p>
      <Link
        href="/dashboard"
        className="mt-8 inline-flex min-h-11 touch-manipulation items-center justify-center rounded-[var(--radius)] border border-primary/80 bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-active"
      >
        {t("retry")}
      </Link>
    </main>
  );
}
