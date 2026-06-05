"use client";

import { Link } from "@/src/i18n/navigation";
import { usePathname } from "@/src/i18n/navigation";
import { useTranslations } from "next-intl";
import { Home, Clock, Users, FolderKanban, FileText, MessageSquare, Settings, Shield } from "lucide-react";
import { navItemDefs } from "@/lib/nav-items";

const iconMap = { Home, Clock, Users, FolderKanban, FileText, MessageSquare, Settings, Shield } as const;

const visibleNavItems = navItemDefs.filter((item) => !item.adminOnly);

export function MobileBottomNav() {
  const pathname = usePathname();
  const t = useTranslations("Nav");

  const navItems = visibleNavItems.map((item) => {
    const Icon = iconMap[item.iconName];
    return { name: t(item.labelKey), href: item.href, icon: <Icon className="h-5 w-5" /> };
  });

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.04)] pb-[env(safe-area-inset-bottom)]"
      dir="rtl"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex flex-col items-center justify-center
                min-w-[48px] min-h-[48px] flex-1 px-1 py-2
                transition-all duration-200
                active:scale-95
                ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}
              `}
              aria-label={item.name}
              aria-current={isActive ? "page" : undefined}
            >
              <div className={`
                flex flex-col items-center gap-0.5
                transition-all duration-200
                ${isActive ? "bg-primary/10 rounded-full px-3 py-1" : ""}
              `}>
                <div className="relative">
                  {item.icon}
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" aria-hidden="true" />
                  )}
                </div>
              </div>
              <span className="text-[11px] mt-1 font-medium truncate w-full text-center">
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
