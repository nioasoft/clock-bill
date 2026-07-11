import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";
import { ArrowRight } from "lucide-react";
import { brandName } from "@/lib/brand";

interface LegalPageProps {
  title: string;
  updated: string;
  children: React.ReactNode;
}

/**
 * Shared shell for the public legal pages (privacy / terms). Standalone (no auth
 * shell): readable RTL prose on the dark canvas, brand header, back link.
 *
 * Server component: chrome strings come from the `Legal.page` i18n namespace and
 * the brand word-mark is locale-aware so the English shell shows no Hebrew.
 */
export async function LegalPage({ title, updated, children }: LegalPageProps) {
  const t = await getTranslations("Legal.page");
  const locale = await getLocale();

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <Link
          href="/"
          className="inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-[var(--radius)] px-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
          {t("backTo", { brand: brandName(locale) })}
        </Link>

        <header className="mt-8 border-b border-border pb-6">
          <h1 className="text-balance font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("updatedLabel", { date: updated })}</p>
        </header>

        <article className="mt-8 space-y-8 leading-relaxed text-foreground/90 [&_section]:scroll-mt-6 [&_h2]:mb-2 [&_h2]:text-pretty [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_p]:text-pretty [&_p]:text-base [&_p+p]:mt-3 [&_ul]:mt-2 [&_ul]:space-y-1.5 [&_li]:ms-5 [&_li]:text-base [&_li]:list-disc [&_strong]:font-semibold [&_strong]:text-foreground [&_a]:rounded-sm [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a]:focus-visible:outline-none [&_a]:focus-visible:ring-2 [&_a]:focus-visible:ring-ring">
          {children}
        </article>

        <footer className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
          <p>
            {t("questions")}{" "}
            <Link href="/contact" className="inline-flex min-h-11 items-center text-primary underline underline-offset-4">
              {t("contactCta")}
            </Link>
          </p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/privacy" className="inline-flex min-h-11 items-center hover:text-foreground">{t("privacyLink")}</Link>
            <Link href="/terms" className="inline-flex min-h-11 items-center hover:text-foreground">{t("termsLink")}</Link>
            <Link href="/contact" className="inline-flex min-h-11 items-center hover:text-foreground">{t("contactLink")}</Link>
            <Link href="/accessibility" className="inline-flex min-h-11 items-center hover:text-foreground">{t("accessibilityLink")}</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
