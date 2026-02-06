"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar } from "lucide-react";

interface Deadline {
  id: string;
  name: string;
  endDate: string;
  clientName: string;
  daysUntilDeadline: number;
}

interface UpcomingDeadlinesProps {
  userId?: string;
}

export function UpcomingDeadlines({ userId }: UpcomingDeadlinesProps) {
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDeadlines() {
      try {
        const response = await fetch("/api/dashboard/stats");
        if (response.ok) {
          const data = await response.json();
          setDeadlines(data.stats?.upcomingDeadlines || []);
        }
      } catch (error) {
        console.error("Error fetching deadlines:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDeadlines();
  }, [userId]);

  if (loading) {
    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900">יעדים קרובים</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (deadlines.length === 0) {
    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900">יעדים קרובים</h3>
        </div>
        <p className="text-sm text-gray-500">
          אין פרויקטים עם יעדים קרובים
        </p>
      </div>
    );
  }

  const getUrgencyColor = (days: number) => {
    if (days <= 3) return "text-red-600 bg-red-50";
    if (days <= 7) return "text-orange-600 bg-orange-50";
    if (days <= 14) return "text-yellow-600 bg-yellow-50";
    return "text-green-600 bg-green-50";
  };

  const getUrgencyText = (days: number) => {
    if (days === 0) return "היום";
    if (days === 1) return "מחר";
    return `בעוד ${days} ימים`;
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900">יעדים קרובים</h3>
        </div>
        <Link
          href="/projects"
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          לכל הפרויקטים →
        </Link>
      </div>

      <div className="space-y-3">
        {deadlines.map((deadline) => (
          <Link
            key={deadline.id}
            href={`/projects/${deadline.id}`}
            className="block p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {deadline.name}
                </p>
                <p className="text-sm text-gray-500 truncate">
                  {deadline.clientName}
                </p>
              </div>
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${getUrgencyColor(deadline.daysUntilDeadline)}`}>
                {getUrgencyText(deadline.daysUntilDeadline)}
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              תאריך יעד: {new Date(deadline.endDate).toLocaleDateString('he-IL')}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
