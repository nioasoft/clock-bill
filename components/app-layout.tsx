"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";

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

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center" dir="rtl">
        <div className="text-gray-600">טוען...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-zinc-50" dir="rtl">
      {/* Mobile Navigation */}
      <MobileNav userEmail={user.email} onLogout={handleLogout} />

      {/* Desktop Layout */}
      <div className="hidden lg:flex">
        {/* Sidebar - fixed on the right for RTL */}
        <div className="fixed right-0 top-0 h-screen">
          <Sidebar />
        </div>

        {/* Main content - offset by sidebar width */}
        <div className="mr-64 flex-1">
          <main className="min-h-screen">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile Layout - full width */}
      <div className="lg:hidden">
        <main className="min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
