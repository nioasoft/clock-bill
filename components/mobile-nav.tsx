"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Home, Gauge, Users, FolderKanban, FileText, Settings, Shield } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { navItemDefs } from "@/lib/nav-items";
import { HourglassSVG } from "@/components/ui/thematic-elements";
import { BRAND } from "@/lib/brand";

const iconMap = { Home, Clock: Gauge, Users, FolderKanban, FileText, Settings, Shield } as const;

interface MobileNavProps {
  userEmail?: string;
  onLogout?: () => void;
  userRole?: string;
}

export function MobileNav({ userEmail, onLogout, userRole }: MobileNavProps) {
  const pathname = usePathname();

  // Extract first letter for avatar
  const firstLetter = userEmail?.charAt(0).toUpperCase() || "א";

  return (
    <DialogPrimitive.Root>
      {/* Header with hamburger menu */}
      <header className="lg:hidden bg-sidebar shadow-sm sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center justify-between">
          {/* Hamburger button - large touch target */}
          <DialogPrimitive.Trigger asChild>
            <button
              className="min-h-[44px] min-w-[44px] p-2 rounded-lg text-white/60 hover:bg-white/8 transition-colors"
              aria-label="תפריט"
            >
              <Menu className="h-6 w-6" />
            </button>
          </DialogPrimitive.Trigger>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-accent to-accent/80 rounded-lg flex items-center justify-center">
              <Gauge className="h-5 w-5 text-sidebar" />
            </div>
            <h1 className="text-xl font-bold text-white">{BRAND.name}</h1>
          </Link>

          {/* User menu */}
          <div className="flex items-center gap-2">
            {userEmail && (
              <div className="w-8 h-8 bg-accent text-sidebar rounded-full flex items-center justify-center font-bold text-sm">
                {firstLetter}
              </div>
            )}
            {onLogout && (
              <button
                onClick={onLogout}
                aria-label="התנתק"
                className="min-h-[44px] min-w-[44px] p-2 text-sm text-white/80 hover:text-white"
              >
                התנתק
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile menu overlay - using Radix Dialog for focus trap + Escape + backdrop click */}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-label="תפריט ניווט"
          className="fixed inset-y-0 right-0 w-72 bg-sidebar shadow-xl z-50 lg:hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300 flex flex-col relative"
          dir="rtl"
        >
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <DialogPrimitive.Close asChild>
              <Link
                href="/"
                className="flex items-center gap-2"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-accent to-accent/80 rounded-lg flex items-center justify-center">
                  <Gauge className="h-5 w-5 text-sidebar" />
                </div>
                <h1 className="text-xl font-bold text-white">{BRAND.name}</h1>
              </Link>
            </DialogPrimitive.Close>
            <DialogPrimitive.Close asChild>
              <button
                className="min-h-[44px] min-w-[44px] p-2 rounded-lg text-white/60 hover:bg-white/8"
                aria-label="סגור"
              >
                <X className="h-6 w-6" />
              </button>
            </DialogPrimitive.Close>
          </div>

          {/* Navigation links */}
          <nav className="p-4 space-y-1 overflow-y-auto flex-1">
            {navItemDefs
              .filter((item) => !item.adminOnly || userRole === "admin")
              .map((item) => {
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              const Icon = iconMap[item.iconName];

              return (
                <DialogPrimitive.Close key={item.href} asChild>
                  <Link
                    href={item.href}
                    className={`
                      min-h-[52px] flex items-center gap-3 px-4 rounded-lg text-sm font-medium transition-colors
                      ${
                        isActive
                          ? "bg-white/12 text-white"
                          : "text-white/60 hover:bg-white/8 hover:text-white"
                      }
                    `}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </Link>
                </DialogPrimitive.Close>
              );
            })}
          </nav>

          {/* User info at bottom */}
          {userEmail && (
            <div className="p-4 border-t border-white/10">
              <div className="flex items-center gap-3 px-4 py-2">
                <div className="w-10 h-10 bg-accent text-sidebar rounded-full flex items-center justify-center font-bold">
                  {firstLetter}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/40 mb-0.5">מחובר כ:</p>
                  <p className="text-sm font-medium text-white truncate">{userEmail}</p>
                </div>
              </div>
            </div>
          )}
          {/* Decorative watermark */}
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 pointer-events-none">
            <HourglassSVG size={120} className="text-white opacity-[0.03]" />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
