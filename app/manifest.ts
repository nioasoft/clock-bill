import type { MetadataRoute } from "next";

/**
 * PWA manifest (served at /manifest.webmanifest). ClickHouse dark theme.
 * Shortcuts give a near-"widget" feel: long-press the home-screen icon to
 * jump straight to starting a timer or today's entries.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ClockBill — מעקב שעות עבודה",
    short_name: "ClockBill",
    description: "מעקב שעות, ניהול לקוחות ודוחות מקצועיים — בעברית.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "he",
    dir: "rtl",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    categories: ["productivity", "business", "finance"],
    icons: [
      { src: "/web-app-manifest-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/web-app-manifest-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/web-app-manifest-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/web-app-manifest-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "התחל טיימר",
        short_name: "טיימר",
        description: "התחל מדידת זמן חדשה",
        url: "/dashboard?action=start-timer",
        icons: [{ src: "/web-app-manifest-192x192.png", sizes: "192x192" }],
      },
      {
        name: "רשומות היום",
        short_name: "היום",
        description: "צפה ברשומות הזמן של היום",
        url: "/entries?filter=today",
        icons: [{ src: "/web-app-manifest-192x192.png", sizes: "192x192" }],
      },
      {
        name: "רשומה חדשה",
        short_name: "רשומה",
        description: "הוסף רשומת זמן ידנית",
        url: "/entries?action=new",
        icons: [{ src: "/web-app-manifest-192x192.png", sizes: "192x192" }],
      },
    ],
  };
}
