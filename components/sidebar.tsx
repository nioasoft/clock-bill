"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Gauge,
  Users,
  FolderKanban,
  FileText,
  MessageSquare,
  Settings,
  Shield,
  LogOut,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { useState } from "react";
import { GlobalSearch } from "./global-search";
import { navItemDefs } from "@/lib/nav-items";
import { ClockFaceMarks } from "@/components/ui/thematic-elements";
import { BRAND } from "@/lib/brand";

const iconMap = { Home, Clock: Gauge, Users, FolderKanban, FileText, MessageSquare, Settings, Shield } as const;

interface SidebarProps {
  className?: string;
  isCollapsed?: boolean;
  onToggle?: () => void;
  userRole?: string;
  userName?: string | null;
  userEmail?: string;
}

export function Sidebar({
  className = "",
  isCollapsed = false,
  onToggle,
  userRole,
  userName,
  userEmail,
}: SidebarProps) {
  // Prefer the real name; fall back to the local-part of the email, then a
  // generic label. The avatar shows the first letter of whichever we land on.
  const displayName =
    userName?.trim() || userEmail?.split("@")[0] || "הפרופיל שלי";
  const avatarInitial = displayName.charAt(0).toUpperCase();
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
      aria-label="סרגל צד"
      className={`flex flex-col bg-sidebar text-sidebar-foreground h-full transition-all duration-200 ${
        isCollapsed ? "w-16" : "w-64"
      } ${className}`}
      dir="rtl"
    >
      {/* Logo/Brand with gradient */}
      <div className={`flex items-center h-16 border-b border-white/10 bg-gradient-to-b from-white/5 to-transparent ${isCollapsed ? "px-3" : "px-4"}`}>
        <Link href="/" className="flex items-center gap-3">
          <div className="w-12 h-12 relative flex items-center justify-center shrink-0">
            <ClockFaceMarks size={40} color="#D4A04A" className="absolute inset-0 m-auto" />
            <div className="w-10 h-10 bg-gradient-to-br from-accent to-accent/80 rounded-lg flex items-center justify-center relative z-10">
              <Gauge className="h-6 w-6 text-sidebar" />
            </div>
          </div>
          {!isCollapsed && (
            <h1 className="text-2xl font-display font-bold text-white">{BRAND.name}</h1>
          )}
        </Link>
      </div>

      {/* Global Search */}
      {!isCollapsed && (
        <div className="p-4">
          <GlobalSearch />
        </div>
      )}

      {/* Navigation */}
      <nav className={`flex-1 pb-4 space-y-1 ${isCollapsed ? "px-1.5" : "px-3"}`}>
        {navItemDefs
          .filter((item) => !item.adminOnly || userRole === "admin")
          .map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = iconMap[item.iconName];

          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.name : undefined}
              aria-label={isCollapsed ? item.name : undefined}
              className={`
                flex items-center gap-3 rounded-lg text-sm font-medium transition-colors relative
                ${isCollapsed ? "justify-center px-2 py-2.5" : "px-4 py-2.5"}
                ${
                  isActive
                    ? "bg-white/8 text-white"
                    : "text-white/60 hover:bg-white/6 hover:text-white"
                }
              `}
            >
              {isActive && (
                <span className="absolute start-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true" />
              )}
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
            className={`flex items-center gap-3 rounded-lg text-sm font-medium text-white/40 hover:bg-white/6 hover:text-white transition-colors w-full ${
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

      {/* User info section */}
      <div className={`border-t border-white/10 space-y-1 ${isCollapsed ? "p-1.5" : "p-4"}`}>
        <Link
          href="/settings"
          title={isCollapsed ? displayName : undefined}
          aria-label={isCollapsed ? displayName : undefined}
          className={`flex items-center gap-3 rounded-lg text-sm font-medium text-white/60 hover:bg-white/6 hover:text-white transition-colors ${
            isCollapsed ? "justify-center px-2 py-2.5" : "px-4 py-2.5"
          }`}
        >
          <div className="w-8 h-8 bg-accent text-sidebar rounded-full flex items-center justify-center shrink-0 font-bold text-sm uppercase">
            {avatarInitial}
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="truncate text-white/90">{displayName}</span>
              {userEmail && userName?.trim() && (
                <span className="truncate text-xs text-white/40">{userEmail}</span>
              )}
            </div>
          )}
        </Link>
        <button
          onClick={handleLogout}
          disabled={logoutLoading}
          title={isCollapsed ? "התנתק" : undefined}
          aria-label={isCollapsed ? (logoutLoading ? "מתנתק..." : "התנתק") : undefined}
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
