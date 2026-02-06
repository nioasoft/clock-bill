"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface User {
  id: string;
  email: string;
}

interface DashboardStats {
  today: {
    hours: number;
    formatted: string;
  };
  week: {
    hours: number;
    formatted: string;
  };
  month: {
    hours: number;
    formatted: string;
  };
  clientsCount: number;
  projectsCount: number;
}

interface RecentEntry {
  id: string;
  description: string;
  date: string;
  duration: number;
  formattedDuration: string;
  projectId: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);

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

  useEffect(() => {
    // Fetch dashboard stats when user is loaded
    const fetchStats = async () => {
      if (!user) return;

      try {
        setStatsLoading(true);
        const response = await fetch("/api/dashboard/stats");
        const data = await response.json();

        if (data.success) {
          setStats(data.stats);
          setRecentEntries(data.recentEntries || []);
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, [user]);

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

        {/* Stats Cards */}
        {statsLoading ? (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-lg bg-white p-6 shadow animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Today's Hours */}
            <div className="rounded-lg bg-white p-6 shadow">
              <p className="text-sm font-medium text-gray-600">שעות היום</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{stats.today.formatted}</p>
            </div>

            {/* Week's Hours */}
            <div className="rounded-lg bg-white p-6 shadow">
              <p className="text-sm font-medium text-gray-600">שעות השבוע</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{stats.week.formatted}</p>
            </div>

            {/* Month's Hours */}
            <div className="rounded-lg bg-white p-6 shadow">
              <p className="text-sm font-medium text-gray-600">שעות החודש</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{stats.month.formatted}</p>
            </div>

            {/* Clients/Projects Count */}
            <div className="rounded-lg bg-white p-6 shadow">
              <p className="text-sm font-medium text-gray-600">לקוחות ופרויקטים</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {stats.clientsCount} / {stats.projectsCount}
              </p>
            </div>
          </div>
        ) : null}

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

        {/* Recent Entries */}
        {recentEntries.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">רשומות אחרונות</h3>
            <div className="rounded-lg bg-white shadow overflow-hidden">
              <ul className="divide-y divide-gray-200">
                {recentEntries.map((entry) => (
                  <li key={entry.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{entry.description}</p>
                        <p className="text-sm text-gray-500">{entry.date}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-900">{entry.formattedDuration}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
