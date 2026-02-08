import type { Metadata, Viewport } from "next";
import { Assistant, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/providers";

// Validate environment variables on server startup
import "@/lib/env";

const assistant = Assistant({
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
};

export const metadata: Metadata = {
  title: "מוניט - מעקב שעות עבודה לפרילנסרים",
  description: "מעקב שעות, ניהול לקוחות ודוחות מקצועיים בעברית. הכל במקום אחד, בחינם.",
  keywords: ["מעקב זמן", "פרילנסר", "שעות עבודה", "ניהול פרויקטים", "דוחות", "מוניט"],
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
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  appleWebApp: {
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
      <body className={`${assistant.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        {/* Skip to main content link for keyboard users */}
        <a href="#main-content" className="skip-to-main">
          דלג לתוכן ראשי
        </a>
        <Providers>
          <main id="main-content">
            {children}
          </main>
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
