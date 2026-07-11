import { getLocale, getTranslations } from "next-intl/server";
import { LogIn } from "lucide-react";
import { Link } from "@/src/i18n/navigation";
import { brandName } from "@/lib/brand";
import { BrandMark } from "@/components/brand-mark";
import { ClockFaceMarks } from "@/components/ui/thematic-elements";
import { LocaleSwitcher } from "@/components/locale-switcher";

export async function LandingNavbar() {
  const t = await getTranslations("Landing");
  const locale = await getLocale();
  const brand = brandName(locale);

  return (
    <nav
      aria-label={t("nav.ariaLabel")}
      className="fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-50 mx-auto w-[calc(100%-1.5rem)] max-w-5xl rounded-full border border-border bg-background shadow-sm"
    >
      <div className="flex min-h-14 items-center justify-between gap-2 px-2.5 sm:px-4">
        <Link
          href="/"
          aria-label={brand}
          className="flex min-h-11 min-w-11 items-center gap-2 rounded-full px-1.5 text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-primary text-primary-foreground">
            <ClockFaceMarks
              size={24}
              className="absolute inset-0 m-auto text-primary-foreground/20"
              aria-hidden="true"
            />
            <BrandMark className="relative h-5 w-5" />
          </span>
          <span className="hidden text-lg font-bold sm:inline">{brand}</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          <a
            href="#how-it-works"
            className="inline-flex min-h-11 items-center rounded-full px-3 text-sm text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("nav.howItWorks")}
          </a>
          <a
            href="#features"
            className="inline-flex min-h-11 items-center rounded-full px-3 text-sm text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("nav.features")}
          </a>
          <Link
            href="/pricing"
            className="inline-flex min-h-11 items-center rounded-full px-3 text-sm text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("nav.pricing")}
          </Link>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <LocaleSwitcher isCollapsed />
          <Link
            href="/login"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-2 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3"
          >
            <LogIn className="h-4 w-4 sm:hidden" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">{t("nav.login")}</span>
          </Link>
          <Link
            href="/register"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-4"
          >
            <span className="sm:hidden">{t("nav.ctaShort")}</span>
            <span className="hidden sm:inline">{t("nav.ctaStart")}</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
