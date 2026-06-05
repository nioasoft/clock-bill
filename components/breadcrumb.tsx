"use client";

import { Link } from "@/src/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className = "" }: BreadcrumbProps) {
  const t = useTranslations("Nav");
  const locale = useLocale();
  // Separator points along the reading flow: left in RTL, right in LTR.
  const Separator = locale === "he" ? ChevronLeft : ChevronRight;
  return (
    <nav
      aria-label={t("breadcrumbLabel")}
      className={`flex items-center gap-2 text-sm ${className}`}
    >
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {index > 0 && (
            <Separator className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          {item.href ? (
            <Link
              href={item.href}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}
