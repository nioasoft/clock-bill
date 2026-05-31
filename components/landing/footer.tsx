import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { ClockFaceMarks } from "@/components/ui/thematic-elements";

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-sidebar text-sidebar-foreground py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main footer content */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-8">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <ClockFaceMarks size={20} className="text-accent" />
              <span className="text-lg font-display font-bold text-white">
                {BRAND.name}
              </span>
            </div>
            <p className="text-sm text-sidebar-foreground/70">
              {BRAND.tagline}
            </p>
          </div>

          {/* Navigation links */}
          <nav aria-label="ניווט תחתון" className="flex flex-wrap gap-6 text-sm">
            <a
              href="#how-it-works"
              className="text-sidebar-foreground/80 hover:text-white transition-colors"
            >
              איך זה עובד
            </a>
            <a
              href="#features"
              className="text-sidebar-foreground/80 hover:text-white transition-colors"
            >
              פיצ&apos;רים
            </a>
            <a
              href="#faq"
              className="text-sidebar-foreground/80 hover:text-white transition-colors"
            >
              שאלות נפוצות
            </a>
            <Link
              href="/login"
              className="text-sidebar-foreground/80 hover:text-white transition-colors"
            >
              התחבר
            </Link>
            <Link
              href="/privacy"
              className="text-sidebar-foreground/80 hover:text-white transition-colors"
            >
              פרטיות
            </Link>
            <Link
              href="/terms"
              className="text-sidebar-foreground/80 hover:text-white transition-colors"
            >
              תנאי שימוש
            </Link>
          </nav>
        </div>

        {/* Decorative divider with clock pattern */}
        <div className="relative mb-6">
          <div className="border-t border-dashed border-sidebar-foreground/20" />
        </div>

        {/* Copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-sidebar-foreground/60">
          <p>
            {year} &copy; {BRAND.name} &middot; נבנה עם &#9829; בישראל
          </p>
          <p className="text-xs">כל הזכויות שמורות</p>
        </div>
      </div>
    </footer>
  );
}
