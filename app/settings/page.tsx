"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Session {
  id: string;
  created_at: string;
  expires_at: string;
  is_current: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"profile" | "security">("security");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  useEffect(() => {
    if (activeTab === "security") {
      fetchSessions();
    }
  }, [activeTab]);

  const fetchSessions = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/sessions");
      const data = await response.json();

      if (data.success) {
        setSessions(data.sessions || []);
      } else {
        setError(data.message || "שגיאה בטעינת הפעולות");
      }
    } catch {
      setError("שגיאת תקשורת. אנא נסה שוב.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("he-IL", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDeviceInfo = (sessionId: string) => {
    // In a real implementation, this would use user-agent parsing
    // For now, we return a generic device identifier
    return `מכשיר ${sessionId.slice(0, 8)}`;
  };

  const handleLogoutAll = async () => {
    setLogoutAllLoading(true);
    setError("");
    try {
      const response = await fetch("/api/sessions", {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        // Redirect to login page after successful logout
        router.push("/login");
      } else {
        setError(data.message || "שגיאה בהתנתקות מכל המכשירים");
        setShowConfirmDialog(false);
      }
    } catch {
      setError("שגיאת תקשורת. אנא נסה שוב.");
      setShowConfirmDialog(false);
    } finally {
      setLogoutAllLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50" dir="rtl">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-2xl font-bold text-gray-900 hover:text-orange-600"
            >
              שעון
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              חזרה לדשבורד
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">הגדרות</h1>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-8">
          <nav className="flex gap-8">
            <button
              onClick={() => setActiveTab("profile")}
              className={`pb-4 px-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "profile"
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              פרופיל
            </button>
            <button
              onClick={() => setActiveTab("security")}
              className={`pb-4 px-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "security"
                  ? "border-orange-500 text-orange-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              אבטחה
            </button>
          </nav>
        </div>

        {/* Security Tab Content */}
        {activeTab === "security" && (
          <div className="space-y-8">
            {/* Active Sessions Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  פעולות פעילות
                </h2>
                {sessions.length > 1 && (
                  <button
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={logoutAllLoading}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {logoutAllLoading ? "מתנתק..." : "התנתק מכל המכשירים"}
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-6">
                רשימת כל המכשירים שמחוברים כרגע לחשבון שלך.
              </p>

              {loading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent"></div>
                  <p className="mt-2 text-gray-600">טוען פעולות...</p>
                </div>
              ) : error ? (
                <div className="rounded-md bg-red-50 p-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-gray-600 text-center py-8">
                  אין פעולות פעילות
                </p>
              ) : (
                <div className="space-y-4">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        session.is_current
                          ? "border-orange-200 bg-orange-50"
                          : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <svg
                            className="w-5 h-5 text-gray-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {getDeviceInfo(session.id)}
                            {session.is_current && (
                              <span className="mr-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                נוכחי
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-gray-600">
                            התחברות: {formatDate(session.created_at)}
                          </p>
                          <p className="text-sm text-gray-500">
                            תפוגה: {formatDate(session.expires_at)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Profile Tab Content */}
        {activeTab === "profile" && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              פרטי פרופיל
            </h2>
            <p className="text-gray-600">
              ניהול פרטי פרופיל יהיה זמין בקרוב.
            </p>
          </div>
        )}
      </main>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" dir="rtl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              האם אתה בטוח?
            </h3>
            <p className="text-gray-600 mb-6">
              פעולה זו תנתק אותך מכל המכשירים המחוברים לחשבון שלך, כולל המכשיר הנוכחי. תצטרך להתחבר מחדש.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmDialog(false)}
                disabled={logoutAllLoading}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                ביטול
              </button>
              <button
                onClick={handleLogoutAll}
                disabled={logoutAllLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {logoutAllLoading ? "מתנתק..." : "התנתק מכל המכשירים"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
