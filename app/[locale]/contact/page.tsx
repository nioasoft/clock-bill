import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/src/i18n/navigation";
import { ArrowRight } from "lucide-react";
import { brandName } from "@/lib/brand";
import { ContactForm } from "@/components/contact-form";
import { PublicAccessibilityLink } from "@/components/public-accessibility-link";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Contact");
  const brand = brandName(await getLocale());
  return {
    title: t("meta.title", { brand }),
    description: t("meta.description", { brand }),
  };
}

/**
 * Public contact page. Standalone (no auth shell) so logged-out visitors from
 * the landing and legal pages can reach it. Mirrors the legal-page layout.
 */
export default async function ContactPage() {
  const t = await getTranslations("Contact");
  const brand = brandName(await getLocale());
  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" />
          {t("back", { brand })}
        </Link>

        <header className="mt-8 mb-8">
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-2 text-muted-foreground leading-relaxed">
            {t("description")}
          </p>
        </header>

        <ContactForm />
        <p className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
          <PublicAccessibilityLink className="hover:text-foreground" />
        </p>
      </div>
    </main>
  );
}
