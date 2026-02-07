"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { MobileBottomNav } from "./mobile-bottom-nav";
import { ErrorBoundary } from "./error-boundary";
import { PersistentTimerBar } from "./persistent-timer-bar";
import { TimerStartModal } from "./timer-start-modal";
import { TimerStopModal } from "./timer-stop-modal";

interface User {
  id: string;
  email: string;
}

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar-collapsed") === "true";
    }
    return false;
  });

  useEffect(() => {
    // Fetch current session
    const fetchUser = async () => {
      try {
        const response = await fetch("/api/auth/session");
        const data = await response.json();

        if (data.success && data.user) {
          setUser(data.user);
        } else {
          // No session, redirect to login
          router.push("/login");
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        router.push("/login");
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [router]);

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

  const handleSidebarToggle = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">טוען...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Navigation */}
      <MobileNav userEmail={user.email} onLogout={handleLogout} />

      {/* Desktop Layout */}
      <div className="hidden lg:flex">
        {/* Sidebar - fixed on the right for RTL */}
        <div className="fixed right-0 top-0 h-screen z-30">
          <Sidebar
            isCollapsed={sidebarCollapsed}
            onToggle={handleSidebarToggle}
          />
        </div>

        {/* Main content - offset by sidebar width */}
        <div
          className={`flex-1 min-h-screen flex flex-col transition-[margin] duration-200 ${
            sidebarCollapsed ? "mr-16" : "mr-64"
          }`}
        >
          <PersistentTimerBar />
          <main className="flex-1 overflow-x-hidden">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
      </div>

      {/* Mobile Layout - full width */}
      <div className="lg:hidden pb-16 min-h-screen flex flex-col">
        <PersistentTimerBar />
        <main className="flex-1 overflow-x-hidden">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav />
      </div>

      {/* Timer Modals (rendered at layout level) */}
      <TimerStartModal />
      <TimerStopModal />
    </div>
  );
}
