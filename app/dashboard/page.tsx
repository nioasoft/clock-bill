"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EarningsChart } from "@/components/earnings-chart";
import { ProjectHoursChart } from "@/components/project-hours-chart";
import { useNotifications } from "@/hooks/use-notifications";
import { useTimer } from "@/contexts/timer-context";
import { Users, FolderOpen, Clock } from "lucide-react";
import { ClockFaceMarks, CircularProgress } from "@/components/ui/thematic-elements";

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

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);

  // Timer from global context
  const {
    runningTimer,
    elapsedTime,
    timerLoading,
    pausingTimer,
    resumingTimer,
    stoppingTimer,
    projects,
    setShowTimerModal,
    handlePauseTimer,
    handleResumeTimer,
    handleStopTimer,
  } = useTimer();

  // Resolve the running timer's project for the hero details.
  const runningProject = runningTimer
    ? projects.find((p) => p.id === runningTimer.projectId) ?? null
    : null;

  // Daily reminder notification
  const { checkDailyReminder } = useNotifications();

  // Fetch dashboard stats
  useEffect(() => {
    const fetchStats = async () => {
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
        setStatsError(true);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Check for daily reminder every minute
  useEffect(() => {
    const checkDailyReminderInterval = setInterval(() => {
      if (stats) {
        checkDailyReminder(stats.today.hours);
      }
    }, 60000);

    if (stats) {
      checkDailyReminder(stats.today.hours);
    }

    return () => clearInterval(checkDailyReminderInterval);
  }, [stats, checkDailyReminder]);

  const isFirstTimeUser = stats &&
    stats.clientsCount === 0 &&
    stats.projectsCount === 0 &&
    stats.today.hours === 0 &&
    stats.month.hours === 0;

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="ברוך הבא!"
          subtitle="זהו הדשבורד שלך. כאן תוכל לנהל את שעות העבודה והפרויקטים שלך."
        />

        {/* First-time user checklist */}
        {!statsLoading && !statsError && isFirstTimeUser && (
          <div className="mt-6 rounded-[var(--radius-card)] bg-accent/5 border border-accent/20 p-5 sm:p-6 motion-safe:animate-fade-up">
            <h3 className="font-display text-xl font-semibold text-foreground mb-1">בוא נתחיל!</h3>
            <p className="text-sm text-muted-foreground mb-5">שלושה צעדים קצרים כדי להתחיל לעבוד</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Link
                href="/clients?create=true"
                className="group flex flex-col gap-3 p-4 rounded-[var(--radius)] bg-card border border-border hover:border-primary/50 hover:bg-card-elevated transition-colors min-h-[44px]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-primary text-lg transition-transform group-hover:-translate-x-1">←</span>
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">צור לקוח ראשון</p>
                  <p className="text-sm text-muted-foreground">הוסף את הלקוח הראשון שלך</p>
                </div>
              </Link>
              <Link
                href="/projects?create=true"
                className="group flex flex-col gap-3 p-4 rounded-[var(--radius)] bg-card border border-border hover:border-primary/50 hover:bg-card-elevated transition-colors min-h-[44px]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10">
                    <FolderOpen className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <span className="text-primary text-lg transition-transform group-hover:-translate-x-1">←</span>
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">צור פרויקט ראשון</p>
                  <p className="text-sm text-muted-foreground">הגדר פרויקט עם מודל תמחור</p>
                </div>
              </Link>
              <Link
                href="/entries"
                className="group flex flex-col gap-3 p-4 rounded-[var(--radius)] bg-card border border-border hover:border-primary/50 hover:bg-card-elevated transition-colors min-h-[44px]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
                    <Clock className="h-5 w-5 text-success" />
                  </div>
                  <span className="text-primary text-lg transition-transform group-hover:-translate-x-1">←</span>
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">רשום זמן או הפעל טיימר</p>
                  <p className="text-sm text-muted-foreground">התחל לעקוב אחר שעות העבודה שלך</p>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        {statsLoading ? (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-card border border-border/50 rounded-[var(--radius-card)] p-4 shadow-sm">
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-8 w-3/4" />
              </div>
            ))}
          </div>
        ) : statsError ? (
          <div className="mt-5 rounded-[var(--radius-card)] bg-destructive/10 p-6 text-center">
            <p className="text-destructive">שגיאה בטעינת הנתונים. נסה לרענן את הדף.</p>
          </div>
        ) : stats && !isFirstTimeUser ? (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="relative bg-card border border-border/50 border-s-2 border-s-primary rounded-[var(--radius-card)] p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all motion-safe:animate-fade-up stagger-1">
              <div className="absolute top-2 start-2">
                <CircularProgress value={Math.min((stats.today.hours / 8) * 100, 100)} size={24} strokeWidth={2} className="text-primary/20" />
              </div>
              <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">שעות היום</p>
              <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-foreground">{stats.today.formatted}</p>
            </div>

            <div className="relative bg-card border border-border/50 border-s-2 border-s-primary rounded-[var(--radius-card)] p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all motion-safe:animate-fade-up stagger-2">
              <div className="absolute top-2 start-2">
                <CircularProgress value={Math.min((stats.week.hours / 40) * 100, 100)} size={24} strokeWidth={2} className="text-primary/20" />
              </div>
              <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">שעות השבוע</p>
              <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-foreground">{stats.week.formatted}</p>
            </div>

            <div className="relative bg-card border border-border/50 border-s-2 border-s-primary rounded-[var(--radius-card)] p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all motion-safe:animate-fade-up stagger-3">
              <div className="absolute top-2 start-2">
                <CircularProgress value={Math.min((stats.month.hours / 160) * 100, 100)} size={24} strokeWidth={2} className="text-primary/20" />
              </div>
              <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">שעות החודש</p>
              <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-foreground">{stats.month.formatted}</p>
            </div>

            <div className="relative bg-card border border-border/50 border-s-2 border-s-accent rounded-[var(--radius-card)] p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all motion-safe:animate-fade-up stagger-4">
              <div className="absolute top-2 start-2">
                <CircularProgress value={75} size={24} strokeWidth={2} className="text-accent/20" />
              </div>
              <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">הכנסות החודש</p>
              <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-foreground">
                {stats.earnings.formatted}
              </p>
            </div>

            <div className="relative bg-card border border-border/50 border-s-2 border-s-secondary rounded-[var(--radius-card)] p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all motion-safe:animate-fade-up stagger-5">
              <div className="absolute top-2 start-2">
                <CircularProgress value={(stats.projectsCount / 10) * 100} size={24} strokeWidth={2} className="text-secondary/20" />
              </div>
              <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">פרויקטים פעילים</p>
              <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-foreground">
                {stats.projectsCount}
              </p>
            </div>

            <div className="relative bg-card border border-border/50 border-s-2 border-s-secondary rounded-[var(--radius-card)] p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all motion-safe:animate-fade-up stagger-5">
              <div className="absolute top-2 start-2">
                <CircularProgress value={(stats.clientsCount / 10) * 100} size={24} strokeWidth={2} className="text-secondary/20" />
              </div>
              <p className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">לקוחות</p>
              <p className="mt-2 font-mono text-3xl font-bold tabular-nums text-foreground">
                {stats.clientsCount}
              </p>
            </div>
          </div>
        ) : null}

        {/* Quick Timer — hero */}
        <div className="mt-6 bg-card border border-border/50 rounded-[var(--radius-card)] p-6 sm:p-8 relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              {runningTimer ? (
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-foreground flex items-center gap-2.5">
                  {runningTimer.pausedAt ? (
                    <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-400">
                      מושהה
                    </span>
                  ) : (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    </span>
                  )}
                  {runningTimer.pausedAt ? "טיימר מושהה" : "טיימר פעיל"}
                </h3>
              ) : (
                <>
                  <h3 className="font-display text-xl sm:text-2xl font-semibold text-foreground">טיימר מהיר</h3>
                  <p className="mt-1 text-sm text-muted-foreground">התחל לעקוב אחר הזמן בלחיצה אחת</p>
                </>
              )}
            </div>
            {!runningTimer && (
              <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted border border-border rounded">T</kbd>
            )}
          </div>

          {timerLoading ? (
            <div className="mt-6 space-y-4" aria-hidden="true">
              <div className="h-12 w-40 rounded bg-muted animate-pulse" />
              <div className="h-4 w-48 rounded bg-muted animate-pulse" />
              <div className="h-4 w-32 rounded bg-muted animate-pulse" />
            </div>
          ) : runningTimer ? (
            <div className="mt-6">
              <p className="font-mono timer-display font-bold text-primary">{elapsedTime}</p>

              {/* Running timer details */}
              <div className="mt-4 flex flex-col gap-2 text-sm text-muted-foreground">
                {runningProject && (
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-foreground font-medium">{runningProject.name}</span>
                  </div>
                )}
                {runningTimer.description && (
                  <p className="text-foreground/90 leading-relaxed">{runningTimer.description}</p>
                )}
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>
                    התחיל ב-{new Date(runningTimer.startTime).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:max-w-md">
                {runningTimer.pausedAt ? (
                  <button
                    onClick={handleResumeTimer}
                    disabled={resumingTimer}
                    className="flex-1 rounded-md bg-success px-5 py-3 text-base font-semibold text-success-foreground hover:bg-success/90 disabled:opacity-50 transition-colors"
                  >
                    {resumingTimer ? "מחדש..." : "חדש טיימר"}
                  </button>
                ) : (
                  <button
                    onClick={handlePauseTimer}
                    disabled={pausingTimer}
                    className="flex-1 rounded-md bg-accent px-5 py-3 text-base font-semibold text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors"
                  >
                    {pausingTimer ? "משהה..." : "השהה טיימר"}
                  </button>
                )}
                <button
                  onClick={handleStopTimer}
                  disabled={stoppingTimer}
                  className="flex-1 rounded-md bg-destructive px-5 py-3 text-base font-semibold text-white hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                >
                  {stoppingTimer ? "עוצר..." : "עצור טיימר"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-6 relative flex justify-center sm:justify-start">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <ClockFaceMarks size={120} className="opacity-[0.07]" />
              </div>
              <button
                onClick={() => setShowTimerModal(true)}
                className="relative w-full sm:w-auto sm:min-w-[280px] rounded-md bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground hover:bg-primary/90 transition-all hover:shadow-md"
              >
                התחל טיימר חדש
              </button>
            </div>
          )}
        </div>

        {/* Navigation cards */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Link
            href="/entries"
            className="bg-card border border-border/50 rounded-[var(--radius-card)] p-5 hover:-translate-y-1 hover:border-primary/40 transition-all duration-200"
          >
            <h3 className="font-display text-xl font-semibold text-foreground">רשומות זמן</h3>
            <p className="mt-2 text-base text-muted-foreground">
              צפה ונהל את רשומות הזמן שלך
            </p>
          </Link>

          <Link
            href="/clients"
            className="bg-card border border-border/50 rounded-[var(--radius-card)] p-5 hover:-translate-y-1 hover:border-primary/40 transition-all duration-200"
          >
            <h3 className="font-display text-xl font-semibold text-foreground">לקוחות</h3>
            <p className="mt-2 text-base text-muted-foreground">
              נהל את הלקוחות שלך
            </p>
          </Link>

          <Link
            href="/reports"
            className="bg-card border border-border/50 rounded-[var(--radius-card)] p-5 hover:-translate-y-1 hover:border-primary/40 transition-all duration-200"
          >
            <h3 className="font-display text-xl font-semibold text-foreground">דוחות</h3>
            <p className="mt-2 text-base text-muted-foreground">
              צור דוחות PDF ו-Excel
            </p>
          </Link>
        </div>

        {/* Charts Grid */}
        {!isFirstTimeUser && (
          <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EarningsChart />
            <ProjectHoursChart />
          </div>
        )}

        {/* Recent Entries */}
        {recentEntries.length > 0 && (
          <div className="mt-5">
            <h3 className="font-display text-xl font-semibold text-foreground mb-4">רשומות אחרונות</h3>
            <div className="bg-card border border-border/50 rounded-[var(--radius-card)] shadow-sm overflow-hidden">
              <ul className="divide-y divide-border">
                {recentEntries.map((entry) => (
                  <li key={entry.id} className="px-6 py-4 hover:bg-muted transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{entry.description}</p>
                        <p className="text-sm text-muted-foreground">{new Date(entry.date).toLocaleDateString('he-IL')}</p>
                      </div>
                      <div className="text-end">
                        <p className="font-mono text-sm font-medium tabular-nums text-foreground">{entry.formattedDuration}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
