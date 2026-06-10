import Link from "next/link";

/**
 * Root-level 404 fallback. It renders WITHOUT the [locale] layout, so no
 * globals.css / fonts / theme are available here — styles must be inline.
 * Real page 404s are handled by the styled `app/[locale]/not-found.tsx` via
 * the `[...rest]` catch-all; this only covers paths the proxy matcher
 * excludes (and any notFound() thrown outside the locale tree).
 */
export default function RootNotFound() {
  return (
    <div
      dir="rtl"
      lang="he"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
        color: "#fafafa",
        fontFamily:
          "'Heebo', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        textAlign: "center",
        padding: "1rem",
      }}
    >
      <div>
        <p style={{ fontSize: "5rem", fontWeight: 700, margin: 0, opacity: 0.25 }}>
          404
        </p>
        <h1 style={{ fontSize: "1.5rem", margin: "0.5rem 0" }}>העמוד לא נמצא</h1>
        <p style={{ color: "#a3a3a3", margin: "0 0 1.5rem" }}>
          העמוד שחיפשת לא קיים או שהועבר למקום אחר.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            padding: "0.75rem 1.5rem",
            background: "#faff69",
            color: "#0a0a0a",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          חזרה לדשבורד
        </Link>
      </div>
    </div>
  );
}
