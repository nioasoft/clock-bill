import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "hebrew"],
});

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
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
