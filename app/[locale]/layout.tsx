import type { Metadata, Viewport } from "next";
import { Heebo, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/providers";
import { PwaProvider } from "@/components/pwa-provider";
import { routing } from "@/src/i18n/routing";

// Validate environment variables on server startup
import "@/lib/env";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0a0a0a",
};

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

/** Pre-render both locales at build time. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  const title = t("title");
  const description = t("description");

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://www.clock-bill.com"),
    title,
    description,
    keywords: [
      "מעקב זמן",
      "פרילנסר",
      "שעות עבודה",
      "ניהול פרויקטים",
      "חיוב לפי פריטים",
      "תעודת התחשבנות",
      "ניהול לקוחות",
      "דוחות",
      "מוניט",
    ],
    authors: [{ name: "מוניט" }],
    robots: {
      index: true,
      follow: true,
    },
    // hreflang: Hebrew is prefix-less (default), English is /en.
    alternates: {
      languages: {
        he: "/",
        en: "/en",
      },
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale: locale === "he" ? "he_IL" : "en_US",
      siteName: "מוניט",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    // Icons are auto-detected from app/favicon.ico, app/icon.svg, app/apple-icon.png
    // (Next.js file-based metadata convention). Manifest from app/manifest.ts.
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "מוניט",
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  // Enable static rendering for this locale.
  setRequestLocale(locale);

  const t = await getTranslations("common");
  const dir = locale === "he" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir}>
      <body className={`${heebo.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        {/* Skip to main content link for keyboard users */}
        <a href="#main-content" className="skip-to-main">
          {t("skipToMain")}
        </a>
        <NextIntlClientProvider>
          <Providers>
            <main id="main-content">{children}</main>
          </Providers>
        </NextIntlClientProvider>
        <PwaProvider />
        <Toaster />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
