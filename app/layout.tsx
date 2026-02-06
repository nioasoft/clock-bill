import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className="font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
