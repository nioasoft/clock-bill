"use client";

import { Link } from "@/src/i18n/navigation";
import { usePathname } from "@/src/i18n/navigation";
import { useTranslations } from "next-intl";
import { Home, Clock, Users, FolderKanban, FileText, MessageSquare, Settings, Shield } from "lucide-react";
import { navItemDefs } from "@/lib/nav-items";

const iconMap = { Home, Clock, Users, FolderKanban, FileText, MessageSquare, Settings, Shield } as const;

const visibleNavItems = navItemDefs.filter(
  (item) => !item.adminOnly && !item.mobileHidden
);

export function MobileBottomNav() {
  const pathname = usePathname();
  const t = useTranslations("Nav");

  const navItems = visibleNavItems.map((item) => {
    const Icon = iconMap[item.iconName];
    return {
      name: t(item.mobileLabelKey ?? item.labelKey),
      href: item.href,
      icon: <Icon className="h-5 w-5" aria-hidden="true" />,
    };
  });

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.04)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex min-h-[48px] min-w-[48px] flex-1 touch-manipulation flex-col items-center justify-center rounded-[var(--radius)] px-1 py-1.5
                transition-[background-color,color,transform] duration-200
                active:scale-[0.98] motion-reduce:active:scale-100
                ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}
              `}
              aria-label={item.name}
              aria-current={isActive ? "page" : undefined}
            >
              {item.icon}
              <span className="mt-1 w-full truncate text-center text-xs font-semibold">
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
