"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Clock, Users, FolderKanban, FileText, Settings } from "lucide-react";
import { navItemDefs } from "@/lib/nav-items";

const iconMap = { Home, Clock, Users, FolderKanban, FileText, Settings } as const;

const navItems = navItemDefs.map((item) => {
  const Icon = iconMap[item.iconName];
  return { name: item.name, href: item.href, icon: <Icon className="h-5 w-5" /> };
});

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50"
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
                min-w-0 flex-1 px-1 py-2
                transition-colors duration-200
                ${isActive ? "text-orange-600" : "text-gray-500 hover:text-gray-700"}
              `}
              aria-label={item.name}
              aria-current={isActive ? "page" : undefined}
            >
              <div className={`
                flex items-center justify-center
                transition-all duration-200
                ${isActive ? "transform scale-110" : ""}
              `}>
                {item.icon}
              </div>
              <span className="text-[10px] mt-1 font-medium truncate w-full text-center">
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
