"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Clock, Users, FolderKanban, FileText, Settings, LogOut } from "lucide-react";
import { useState } from "react";
import { GlobalSearch } from "./global-search";

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { name: "דשבורד", href: "/", icon: <Home className="h-5 w-5" /> },
  { name: "רשומות זמן", href: "/entries", icon: <Clock className="h-5 w-5" /> },
  { name: "לקוחות", href: "/clients", icon: <Users className="h-5 w-5" /> },
  { name: "פרויקטים", href: "/projects", icon: <FolderKanban className="h-5 w-5" /> },
  { name: "דוחות", href: "/reports", icon: <FileText className="h-5 w-5" /> },
  { name: "הגדרות", href: "/settings", icon: <Settings className="h-5 w-5" /> },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className = "" }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [logoutLoading, setLogoutLoading] = useState(false);

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      const data = await response.json();

      if (data.success) {
        router.push("/login");
        router.refresh();
      } else {
        console.error("Logout failed:", data.message);
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <aside
      className={`flex flex-col w-64 bg-white border-l border-gray-200 min-h-screen ${className}`}
      dir="rtl"
    >
      {/* Logo/Brand */}
      <div className="p-6 border-b border-gray-200">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center">
            <Clock className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">שעון</h1>
        </Link>
      </div>

      {/* Global Search */}
      <div className="p-4">
        <GlobalSearch />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 pb-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors
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

      {/* User info section at bottom */}
      <div className="p-4 border-t border-gray-200 space-y-1">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
            <Users className="h-4 w-4 text-gray-600" />
          </div>
          <span>הפרופיל שלי</span>
        </Link>
        <button
          onClick={handleLogout}
          disabled={logoutLoading}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {logoutLoading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-600 border-t-transparent" />
          ) : (
            <LogOut className="h-4 w-4" />
          )}
          <span>{logoutLoading ? "מתנתק..." : "התנתק"}</span>
        </button>
      </div>
    </aside>
  );
}
