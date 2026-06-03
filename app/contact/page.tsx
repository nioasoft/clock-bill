import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = {
  title: `יצירת קשר | ${BRAND.name}`,
  description: `יצירת קשר עם ${BRAND.name}. נשמח לשאלות, הצעות או דיווחי תקלה.`,
};

/**
 * Public contact page. Standalone (no auth shell) so logged-out visitors from
 * the landing and legal pages can reach it. Mirrors the legal-page layout.
 */
export default function ContactPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" />
          חזרה ל{BRAND.name}
        </Link>

        <header className="mt-8 mb-8">
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            יצירת קשר
          </h1>
          <p className="mt-2 text-muted-foreground leading-relaxed">
            שאלה, הצעה לשיפור או תקלה? כתבו לנו ונחזור אליכם לאימייל שתשאירו.
          </p>
        </header>

        <ContactForm />
      </div>
    </main>
  );
}
