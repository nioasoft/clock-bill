import type { Metadata, Viewport } from "next";
import { Heebo, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/providers";
import { PwaProvider } from "@/components/pwa-provider";

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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://www.clock-bill.com"),
  title: "מוניט - מעקב שעות עבודה לפרילנסרים",
  description: "מעקב שעות, ניהול לקוחות ודוחות מקצועיים בעברית. הכל במקום אחד, בחינם.",
  keywords: ["מעקב זמן", "פרילנסר", "שעות עבודה", "ניהול פרויקטים", "חיוב לפי פריטים", "תעודת התחשבנות", "ניהול לקוחות", "דוחות", "מוניט"],
  authors: [{ name: "מוניט" }],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "מוניט - מעקב שעות עבודה לפרילנסרים",
    description: "מעקב שעות, ניהול לקוחות ודוחות מקצועיים בעברית. הכל במקום אחד, בחינם.",
    type: "website",
    locale: "he_IL",
    siteName: "מוניט",
  },
  twitter: {
    card: "summary_large_image",
    title: "מוניט - מעקב שעות עבודה לפרילנסרים",
    description: "מעקב שעות, ניהול לקוחות ודוחות מקצועיים בעברית.",
  },
  // Icons are auto-detected from app/favicon.ico, app/icon.svg, app/apple-icon.png
  // (Next.js file-based metadata convention). Manifest from app/manifest.ts.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "מוניט",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        {/* Skip to main content link for keyboard users */}
        <a href="#main-content" className="skip-to-main">
          דלג לתוכן ראשי
        </a>
        <Providers>
          <main id="main-content">
            {children}
          </main>
        </Providers>
        <PwaProvider />
        <Toaster />
      </body>
    </html>
  );
}
