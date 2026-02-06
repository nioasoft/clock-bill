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
  earnings: {
    amount: number;
    formatted: string;
    currency: string;
  };
}

interface RecentEntry {
  id: string;
  description: string;
  date: string;
  duration: number;
  formattedDuration: string;
  projectId: string;
}

interface RunningTimer {
  id: string;
  projectId: string;
  description: string | null;
  startTime: string;
  elapsedMinutes: number;
  elapsedSeconds: number;
}

interface Project {
  id: string;
  name: string;
  clientId: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);
  const [runningTimer, setRunningTimer] = useState<RunningTimer | null>(null);
  const [timerLoading, setTimerLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [timerDescription, setTimerDescription] = useState("");
  const [startingTimer, setStartingTimer] = useState(false);
  const [stoppingTimer, setStoppingTimer] = useState(false);
  const [elapsedTime, setElapsedTime] = useState("0:00");

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

  useEffect(() => {
    // Fetch running timer
    const fetchRunningTimer = async () => {
      if (!user) return;

      try {
        setTimerLoading(true);
        const response = await fetch("/api/timer/running");
        const data = await response.json();

        if (data.success && data.running) {
          setRunningTimer(data.running);
        } else {
          setRunningTimer(null);
        }
      } catch (error) {
        console.error("Error fetching running timer:", error);
      } finally {
        setTimerLoading(false);
      }
    };

    fetchRunningTimer();

    // Poll for timer updates every second
    const interval = setInterval(fetchRunningTimer, 1000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    // Update elapsed time display
    if (!runningTimer) {
      setElapsedTime("0:00");
      return;
    }

    const updateElapsed = () => {
      const now = new Date();
      const start = new Date(runningTimer.startTime);
      const elapsedMs = now.getTime() - start.getTime();
      const minutes = Math.floor(elapsedMs / 1000 / 60);
      const seconds = Math.floor((elapsedMs / 1000) % 60);
      setElapsedTime(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [runningTimer]);

  useEffect(() => {
    // Fetch projects for the timer modal
    const fetchProjects = async () => {
      if (!user) return;

      try {
        const response = await fetch("/api/projects");
        const data = await response.json();

        if (data.success) {
          setProjects(data.projects || []);
        }
      } catch (error) {
        console.error("Error fetching projects:", error);
      }
    };

    fetchProjects();
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

  const handleStartTimer = async () => {
    if (!selectedProject) {
      alert("נא לבחור פרויקט");
      return;
    }

    setStartingTimer(true);
    try {
      const response = await fetch("/api/timer/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProject,
          description: timerDescription || null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setShowTimerModal(false);
        setSelectedProject("");
        setTimerDescription("");
        // Refresh running timer
        const timerResponse = await fetch("/api/timer/running");
        const timerData = await timerResponse.json();
        if (timerData.success && timerData.running) {
          setRunningTimer(timerData.running);
        }
      } else {
        alert(data.message || "שגיאה בהתחלת הטיימר");
      }
    } catch (error) {
      console.error("Error starting timer:", error);
      alert("שגיאה בהתחלת הטיימר");
    } finally {
      setStartingTimer(false);
    }
  };

  const handleStopTimer = async () => {
    if (!runningTimer) return;

    const description = prompt("תיאור לרשומת הזמן (אופציונלי):", runningTimer.description || "");
    if (description === null) return; // User cancelled

    setStoppingTimer(true);
    try {
      const response = await fetch("/api/timer/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId: runningTimer.id,
          description: description || null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setRunningTimer(null);
        // Refresh stats to show the new entry
        const statsResponse = await fetch("/api/dashboard/stats");
        const statsData = await statsResponse.json();
        if (statsData.success) {
          setStats(statsData.stats);
          setRecentEntries(statsData.recentEntries || []);
        }
      } else {
        alert(data.message || "שגיאה בעצירת הטיימר");
      }
    } catch (error) {
      console.error("Error stopping timer:", error);
      alert("שגיאה בעצירת הטיימר");
    } finally {
      setStoppingTimer(false);
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
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-lg bg-white p-6 shadow animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : stats ? (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

            {/* Total Earnings This Month */}
            <div className="rounded-lg bg-white p-6 shadow">
              <p className="text-sm font-medium text-gray-600">הכנסות החודש</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {stats.earnings.formatted}
              </p>
            </div>

            {/* Active Projects Count */}
            <div className="rounded-lg bg-white p-6 shadow">
              <p className="text-sm font-medium text-gray-600">פרויקטים פעילים</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {stats.projectsCount}
              </p>
            </div>

            {/* Clients Count */}
            <div className="rounded-lg bg-white p-6 shadow">
              <p className="text-sm font-medium text-gray-600">לקוחות</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">
                {stats.clientsCount}
              </p>
            </div>
          </div>
        ) : null}

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Quick Timer Widget */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="text-lg font-medium text-gray-900">טיימר מהיר</h3>
            {timerLoading ? (
              <p className="mt-4 text-sm text-gray-600">טוען...</p>
            ) : runningTimer ? (
              <div className="mt-4">
                <p className="text-3xl font-bold text-gray-900">{elapsedTime}</p>
                <p className="mt-2 text-sm text-gray-600">טיימר פעיל</p>
                <button
                  onClick={handleStopTimer}
                  disabled={stoppingTimer}
                  className="mt-4 w-full rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {stoppingTimer ? "עוצר..." : "עצור טיימר"}
                </button>
              </div>
            ) : (
              <div className="mt-4">
                <button
                  onClick={() => setShowTimerModal(true)}
                  className="w-full rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
                >
                  התחל טיימר חדש
                </button>
              </div>
            )}
          </div>

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

      {/* Timer Start Modal */}
      {showTimerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" dir="rtl">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">התחל טיימר חדש</h3>

            <div className="space-y-4">
              <div>
                <label htmlFor="project" className="block text-sm font-medium text-gray-700 mb-1">
                  פרויקט *
                </label>
                <select
                  id="project"
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                  disabled={startingTimer}
                >
                  <option value="">בחר פרויקט</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  תיאור
                </label>
                <input
                  type="text"
                  id="description"
                  value={timerDescription}
                  onChange={(e) => setTimerDescription(e.target.value)}
                  placeholder="מה אתה עובד עליו?"
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500"
                  disabled={startingTimer}
                />
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowTimerModal(false);
                    setSelectedProject("");
                    setTimerDescription("");
                  }}
                  disabled={startingTimer}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
                >
                  ביטול
                </button>
                <button
                  onClick={handleStartTimer}
                  disabled={startingTimer || !selectedProject}
                  className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 disabled:opacity-50"
                >
                  {startingTimer ? "מתחיל..." : "התחל טיימר"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
