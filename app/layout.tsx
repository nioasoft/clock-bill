import type { Metadata } from "next";
import { Heebo, Rubik, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/providers";

// Validate environment variables on server startup
import "@/lib/env";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-sans",
  display: "swap",
});

const rubik = Rubik({
  subsets: ["hebrew", "latin"],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "שעון - מעקב שעות עבודה",
  description: "מערכת לניהול שעות עבודה לפרילנסרים ויועצים עצמאיים",
  keywords: ["מעקב זמן", "פרילנסר", "שעות עבודה", "ניהול פרויקטים", "חשבוניות"],
  authors: [{ name: "שעון" }],
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
  },
  robots: {
    index: false,
    follow: false,
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
    title: "שעון",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.variable} ${rubik.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
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
