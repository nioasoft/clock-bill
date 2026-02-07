"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Clock,
  Users,
  FolderKanban,
  FileText,
  Settings,
  LogOut,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { useState } from "react";
import { GlobalSearch } from "./global-search";
import { navItemDefs } from "@/lib/nav-items";

const iconMap = { Home, Clock, Users, FolderKanban, FileText, Settings } as const;

const navItems = navItemDefs.map((item) => {
  const Icon = iconMap[item.iconName];
  return { name: item.name, href: item.href, icon: Icon };
});

interface SidebarProps {
  className?: string;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({
  className = "",
  isCollapsed = false,
  onToggle,
}: SidebarProps) {
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
      className={`flex flex-col bg-sidebar text-sidebar-foreground h-full transition-all duration-200 ${
        isCollapsed ? "w-16" : "w-64"
      } ${className}`}
      dir="rtl"
    >
      {/* Logo/Brand */}
      <div className={`border-b border-white/10 ${isCollapsed ? "p-3" : "p-4"}`}>
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-accent to-accent/80 rounded-lg flex items-center justify-center shrink-0">
            <Clock className="h-6 w-6 text-sidebar" />
          </div>
          {!isCollapsed && (
            <h1 className="text-2xl font-display font-bold text-white">שעון</h1>
          )}
        </Link>
      </div>

      {/* Global Search - hidden when collapsed */}
      {!isCollapsed && (
        <div className="p-4">
          <GlobalSearch />
        </div>
      )}

      {/* Navigation */}
      <nav className={`flex-1 pb-4 space-y-1 ${isCollapsed ? "px-1.5" : "px-3"}`}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.name : undefined}
              className={`
                flex items-center gap-3 rounded-lg text-sm font-medium transition-colors
                ${isCollapsed ? "justify-center px-2 py-2.5" : "px-4 py-2.5"}
                ${
                  isActive
                    ? "bg-white/12 text-white border-e-2 border-primary"
                    : "text-white/60 hover:bg-white/8 hover:text-white"
                }
              `}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Toggle button */}
      {onToggle && (
        <div className={`px-3 pb-2 ${isCollapsed ? "px-1.5" : ""}`}>
          <button
            onClick={onToggle}
            className={`flex items-center gap-3 rounded-lg text-sm font-medium text-white/40 hover:bg-white/8 hover:text-white transition-colors w-full ${
              isCollapsed ? "justify-center px-2 py-2.5" : "px-4 py-2.5"
            }`}
            title={isCollapsed ? "הרחב סרגל צד" : "כווץ סרגל צד"}
          >
            {isCollapsed ? (
              <PanelRightOpen className="h-5 w-5 shrink-0" />
            ) : (
              <>
                <PanelRightClose className="h-5 w-5 shrink-0" />
                <span>כווץ</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* User info section at bottom */}
      <div className={`border-t border-white/10 space-y-1 ${isCollapsed ? "p-1.5" : "p-4"}`}>
        <Link
          href="/settings"
          title={isCollapsed ? "הפרופיל שלי" : undefined}
          className={`flex items-center gap-3 rounded-lg text-sm font-medium text-white/60 hover:bg-white/8 hover:text-white transition-colors ${
            isCollapsed ? "justify-center px-2 py-2.5" : "px-4 py-2.5"
          }`}
        >
          <div className="w-8 h-8 bg-white/12 rounded-full flex items-center justify-center shrink-0">
            <Users className="h-4 w-4 text-white/60" />
          </div>
          {!isCollapsed && <span>הפרופיל שלי</span>}
        </Link>
        <button
          onClick={handleLogout}
          disabled={logoutLoading}
          title={isCollapsed ? "התנתק" : undefined}
          className={`flex items-center gap-3 rounded-lg text-sm font-medium text-destructive/80 hover:bg-destructive/10 transition-colors w-full disabled:opacity-50 disabled:cursor-not-allowed ${
            isCollapsed ? "justify-center px-2 py-2.5" : "px-4 py-2.5"
          }`}
        >
          {logoutLoading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-destructive border-t-transparent" />
          ) : (
            <LogOut className="h-4 w-4 shrink-0" />
          )}
          {!isCollapsed && (
            <span>{logoutLoading ? "מתנתק..." : "התנתק"}</span>
          )}
        </button>
      </div>
    </aside>
  );
}
