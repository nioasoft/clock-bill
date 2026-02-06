"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface User {
  id: string;
  email: string;
}

export default function DashboardPage() {
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
        // Redirect to login page after successful logout
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
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">שעון</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.email}</span>
            <Link
              href="/settings"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              הגדרות
            </Link>
            <button
              onClick={handleLogout}
              disabled={logoutLoading}
              className="text-sm text-orange-600 hover:text-orange-500 disabled:opacity-50"
            >
              {logoutLoading ? "מתנתק..." : "התנתק"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            ברוך הבא, {user.email}!
          </h2>
          <p className="mt-2 text-gray-600">
            זהו הדשבורד שלך. כאן תוכל לנהל את שעות העבודה והפרויקטים שלך.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/entries"
            className="rounded-lg bg-white p-6 shadow hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-medium text-gray-900">רשומות זמן</h3>
            <p className="mt-2 text-sm text-gray-600">
              צפה ונהל את רשומות הזמן שלך
            </p>
          </Link>

          <Link
            href="/clients"
            className="rounded-lg bg-white p-6 shadow hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-medium text-gray-900">לקוחות</h3>
            <p className="mt-2 text-sm text-gray-600">
              נהל את הלקוחות שלך
            </p>
          </Link>

          <Link
            href="/reports"
            className="rounded-lg bg-white p-6 shadow hover:shadow-md transition-shadow"
          >
            <h3 className="text-lg font-medium text-gray-900">דוחות</h3>
            <p className="mt-2 text-sm text-gray-600">
              צור דוחות PDF ו-Excel
            </p>
          </Link>
        </div>
      </main>
    </div>
  );
}
