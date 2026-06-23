"use client";

import { Link } from "@/src/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { brandName } from "@/lib/brand";
import { BrandMark } from "@/components/brand-mark";
import { ClockFaceMarks } from "@/components/ui/thematic-elements";
import { LocaleSwitcher } from "@/components/locale-switcher";

export function LandingNavbar() {
  const t = useTranslations("Landing");
  const locale = useLocale();
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY < 100) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  return (
    <nav
      aria-label={t("nav.ariaLabel")}
      className={`fixed top-4 left-1/2 -translate-x-1/2 max-w-5xl w-[calc(100%-2rem)] rounded-full bg-background/70 backdrop-blur-xl border border-border/50 shadow-sm z-50 transition-transform duration-300 ${
        isVisible ? "translate-y-0" : "translate-y-[-120%]"
      }`}
    >
      <div className="px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="relative w-9 h-9 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
              <ClockFaceMarks size={24} className="absolute inset-0 m-auto text-primary-foreground/20" />
              <BrandMark className="relative h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-display font-bold text-foreground">
              {brandName(locale)}
            </span>
          </Link>

          {/* Center links - hidden on mobile */}
          <div className="hidden md:flex items-center gap-2">
            <a
              href="#how-it-works"
              className="rounded-full px-4 py-1.5 text-sm text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
            >
              {t("nav.howItWorks")}
            </a>
            <a
              href="#features"
              className="rounded-full px-4 py-1.5 text-sm text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
            >
              {t("nav.features")}
            </a>
            <a
              href="#themes"
              className="rounded-full px-4 py-1.5 text-sm text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
            >
              {t("nav.themes")}
            </a>
            <a
              href="#faq"
              className="rounded-full px-4 py-1.5 text-sm text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
            >
              {t("nav.faq")}
            </a>
            <Link
              href="/pricing"
              className="rounded-full px-4 py-1.5 text-sm text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
            >
              {t("nav.pricing")}
            </Link>
          </div>

          {/* Auth buttons */}
          <div className="flex items-center gap-3">
            <LocaleSwitcher isCollapsed />
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("nav.login")}
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Clock className="h-4 w-4" aria-hidden="true" />
              <span>{t("nav.ctaStart")}</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
