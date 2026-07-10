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
      <div className="w-12 h-1 bg-primary rounded-full mb-6" />
      <h1 className="font-display text-3xl font-bold text-foreground">{t("title")}</h1>
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">{t("body")}</p>
      <Link
        href="/dashboard"
        className="mt-8 inline-flex items-center justify-center rounded-[var(--radius)] bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        {t("retry")}
      </Link>
    </main>
  );
}
