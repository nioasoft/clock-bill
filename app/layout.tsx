import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "שעון - מעקב שעות עבודה",
  description: "מערכת לניהול שעות עבודה לפרילנסרים ויועצים עצמאיים",
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
      </body>
    </html>
  );
}
