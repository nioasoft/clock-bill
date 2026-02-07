"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Home, Clock, Users, FolderKanban, FileText, Settings } from "lucide-react";
import { navItemDefs } from "@/lib/nav-items";

const iconMap = { Home, Clock, Users, FolderKanban, FileText, Settings } as const;

const navItems = navItemDefs.map((item) => {
  const Icon = iconMap[item.iconName];
  return { name: item.name, href: item.href, icon: <Icon className="h-5 w-5" /> };
});

interface MobileNavProps {
  userEmail?: string;
  onLogout?: () => void;
}

export function MobileNav({ userEmail, onLogout }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Header with hamburger menu */}
      <header className="lg:hidden bg-white shadow-sm sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center justify-between">
          {/* Hamburger button - large touch target */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="min-h-[44px] min-w-[44px] p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="תפריט"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">שעון</h1>
          </Link>

          {/* User menu */}
          <div className="flex items-center gap-2">
            {userEmail && (
              <span className="text-xs text-gray-600 max-w-[120px] truncate">
                {userEmail}
              </span>
            )}
            {onLogout && (
              <button
                onClick={onLogout}
                className="text-sm text-orange-600 hover:text-orange-500"
              >
                התנתק
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setIsOpen(false)}
          />

          {/* Slide-out menu */}
          <div
            className="fixed inset-y-0 right-0 w-72 bg-white shadow-xl z-50 lg:hidden transform transition-transform duration-300 ease-in-out"
            dir="rtl"
          >
            {/* Close button */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <Link
                href="/"
                className="flex items-center gap-2"
                onClick={() => setIsOpen(false)}
              >
                <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-gray-900">שעון</h1>
              </Link>
              <button
                onClick={() => setIsOpen(false)}
                className="min-h-[44px] min-w-[44px] p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                aria-label="סגור"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Navigation links */}
            <nav className="p-4 space-y-1 overflow-y-auto flex-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`
                      min-h-[44px] flex items-center gap-3 px-4 rounded-lg text-sm font-medium transition-colors
                      ${
                        isActive
                          ? "bg-orange-50 text-orange-700"
                          : "text-gray-700 hover:bg-gray-50"
                      }
                    `}
                  >
                    {item.icon}
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* User info at bottom */}
            {userEmail && (
              <div className="p-4 border-t border-gray-200">
                <div className="px-4 py-2">
                  <p className="text-xs text-gray-500 mb-1">מחובר כ:</p>
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {userEmail}
                  </p>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
