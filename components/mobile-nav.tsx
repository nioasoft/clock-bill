"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Home, Gauge, Users, FolderKanban, FileText, Settings, Shield } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { navItemDefs } from "@/lib/nav-items";

const iconMap = { Home, Clock: Gauge, Users, FolderKanban, FileText, Settings, Shield } as const;

interface MobileNavProps {
  userEmail?: string;
  onLogout?: () => void;
  userRole?: string;
}

export function MobileNav({ userEmail, onLogout, userRole }: MobileNavProps) {
  const pathname = usePathname();

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
            <h1 className="text-xl font-bold text-white">מוניט</h1>
          </Link>

          {/* User menu */}
          <div className="flex items-center gap-2">
            {userEmail && (
              <span className="text-xs text-white/60 max-w-[120px] truncate">
                {userEmail}
              </span>
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
        <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50 z-40 lg:hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-label="תפריט ניווט"
          className="fixed inset-y-0 right-0 w-72 bg-sidebar shadow-xl z-50 lg:hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300"
          dir="rtl"
        >
          {/* Close button */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <DialogPrimitive.Close asChild>
              <Link
                href="/"
                className="flex items-center gap-2"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-accent to-accent/80 rounded-lg flex items-center justify-center">
                  <Gauge className="h-5 w-5 text-sidebar" />
                </div>
                <h1 className="text-xl font-bold text-white">מוניט</h1>
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
                      min-h-[44px] flex items-center gap-3 px-4 rounded-lg text-sm font-medium transition-colors
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
              <div className="px-4 py-2">
                <p className="text-xs text-white/40 mb-1">מחובר כ:</p>
                <p className="text-sm font-medium text-white truncate">
                  {userEmail}
                </p>
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
