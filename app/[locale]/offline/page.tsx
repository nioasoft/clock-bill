import { Link } from "@/src/i18n/navigation";

export const metadata = {
  title: "אין חיבור — מוניט",
};

/**
 * Offline fallback shown by the service worker when a navigation fails and the
 * page isn't cached. Intentionally static and dependency-free.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center" dir="rtl">
      <div className="w-12 h-1 bg-primary rounded-full mb-6" />
      <h1 className="font-display text-3xl font-bold text-foreground">אין חיבור לאינטרנט</h1>
      <p className="mt-3 max-w-sm text-sm text-muted-foreground">
        נראה שאתה במצב לא מקוון. בדוק את החיבור ונסה שוב — חלק מהמסכים שכבר ביקרת בהם זמינים גם ללא רשת.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 inline-flex items-center justify-center rounded-[var(--radius)] bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        נסה שוב
      </Link>
    </div>
  );
}
