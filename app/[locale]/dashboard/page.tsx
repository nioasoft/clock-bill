"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EarningsChart } from "@/components/earnings-chart";
import { ProjectHoursChart } from "@/components/project-hours-chart";
import { useNotifications } from "@/hooks/use-notifications";
import { useTimer } from "@/contexts/timer-context";
import { Users, FolderOpen, Clock } from "lucide-react";
import { ClockFaceMarks } from "@/components/ui/thematic-elements";

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
    byHours: { amount: number; formatted: string };
    byItems: { amount: number; formatted: string };
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

interface MonthlyEarnings {
  month: string;
  amount: number;
  formatted: string;
}

interface ProjectHours {
  projectId: string;
  projectName: string;
  totalMinutes: number;
  totalHours: number;
  formatted: string;
}

export default function DashboardPage() {
  const t = useTranslations("Dashboard");
  const intlLocale = useLocale() === "en" ? "en-US" : "he-IL";
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);
  const [monthlyEarnings, setMonthlyEarnings] = useState<MonthlyEarnings[]>([]);
  const [projectHours, setProjectHours] = useState<ProjectHours[]>([]);

  // Timer from global context
  const {
    runningTimers,
    elapsedTimes,
    timerLoading,
    pausingTimerId,
    resumingTimerId,
    projects,
    setShowTimerModal,
    handlePauseTimer,
    handleResumeTimer,
    handleStopTimer,
    onTimerStopped,
  } = useTimer();

  // Daily reminder notification
  const { checkDailyReminder } = useNotifications();

  // Fetch dashboard stats. `silent` skips the skeleton for background refreshes
  // (e.g. after a timer stops) so the numbers update in place without a flash.
  const fetchStats = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setStatsLoading(true);
      const response = await fetch("/api/dashboard/stats");
      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
        setRecentEntries(data.recentEntries || []);
        setMonthlyEarnings(data.monthlyEarnings || []);
        setProjectHours(data.projectHours || []);
        setStatsError(false);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
      setStatsError(true);
    } finally {
      if (!opts?.silent) setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Stopping a timer creates a new time entry, so the dashboard numbers change.
  // Re-fetch (silently) when the timer context signals a stop — same pattern the
  // entries page and kanban board use. Returns the unsubscribe fn for cleanup.
  useEffect(() => onTimerStopped(() => fetchStats({ silent: true })), [onTimerStopped, fetchStats]);

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
          title={t("pageTitle")}
          subtitle={t("pageSubtitle")}
        />

        {/* First-time user checklist */}
        {!statsLoading && !statsError && isFirstTimeUser && (
          <div className="mt-6 rounded-[var(--radius-card)] bg-accent/5 border border-accent/20 p-5 sm:p-6 motion-safe:animate-fade-up">
            <h3 className="font-display text-xl font-semibold text-foreground mb-1">{t("gettingStarted.title")}</h3>
            <p className="text-sm text-muted-foreground mb-5">{t("gettingStarted.subtitle")}</p>
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
                  <p className="text-base font-semibold text-foreground">{t("gettingStarted.createClient.title")}</p>
                  <p className="text-sm text-muted-foreground">{t("gettingStarted.createClient.subtitle")}</p>
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
                  <p className="text-base font-semibold text-foreground">{t("gettingStarted.createProject.title")}</p>
                  <p className="text-sm text-muted-foreground">{t("gettingStarted.createProject.subtitle")}</p>
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
                  <p className="text-base font-semibold text-foreground">{t("gettingStarted.logTime.title")}</p>
                  <p className="text-sm text-muted-foreground">{t("gettingStarted.logTime.subtitle")}</p>
                </div>
              </Link>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        {statsLoading ? (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-card border border-border rounded-[var(--radius-card)] p-3 sm:p-4">
                <Skeleton className="h-3 w-1/2 mb-3" />
                <Skeleton className="h-6 w-3/4" />
              </div>
            ))}
          </div>
        ) : statsError ? (
          <div className="mt-5 rounded-[var(--radius-card)] bg-destructive/10 border border-destructive/20 p-6 text-center">
            <p className="text-destructive">{t("stats.error")}</p>
          </div>
        ) : stats && !isFirstTimeUser ? (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[
              // RTL order: first item renders rightmost, last item leftmost.
              // "שעות השבוע" was removed — a Sun-start week crosses the month
              // boundary and read as inconsistent with the month-scoped records
              // view. Today + month are unambiguous. Total revenue (סך הכנסות)
              // is placed last so it sits at the far left.
              { label: t("stats.todayHours"), value: stats.today.formatted, accent: false, stagger: "stagger-1" },
              { label: t("stats.monthHours"), value: stats.month.formatted, accent: false, stagger: "stagger-2" },
              { label: t("stats.earningsByHours"), value: stats.earnings.byHours.formatted, accent: false, stagger: "stagger-3" },
              { label: t("stats.earningsByItems"), value: stats.earnings.byItems.formatted, accent: false, stagger: "stagger-4" },
              { label: t("stats.totalEarnings"), value: stats.earnings.formatted, accent: true, stagger: "stagger-5" },
            ].map((card) => (
              <div
                key={card.label}
                className={`rounded-[var(--radius-card)] border p-3 sm:p-4 transition-colors motion-safe:animate-fade-up ${card.stagger} ${
                  card.accent
                    ? "bg-primary/[0.06] border-primary/25 hover:border-primary/40"
                    : "bg-card border-border hover:border-border-strong"
                }`}
              >
                <p className="text-[10px] sm:text-xs uppercase tracking-widest font-semibold text-muted-foreground">{card.label}</p>
                <p className={`mt-2 font-mono text-xl sm:text-2xl font-bold tabular-nums ${card.accent ? "text-primary" : "text-foreground"}`}>
                  {card.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {/* Quick Timer — hero */}
        {timerLoading ? (
          <div className="mt-5 bg-card border border-border/50 rounded-[var(--radius-card)] p-5 sm:p-6">
            <div className="space-y-4" aria-hidden="true">
              <div className="h-6 w-32 rounded bg-muted animate-pulse" />
              <div className="h-12 w-40 rounded bg-muted animate-pulse" />
              <div className="h-4 w-48 rounded bg-muted animate-pulse" />
            </div>
          </div>
        ) : runningTimers.length > 0 ? (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl sm:text-2xl font-semibold text-foreground">
                {t("activeTimers.title")}
                {runningTimers.length > 1 && (
                  <span className="ms-2 inline-flex items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-sm font-semibold text-primary align-middle">
                    {runningTimers.length}
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowTimerModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Clock className="h-4 w-4" />
                  {t("activeTimers.newTimerButton")}
                </button>
                <Link
                  href="/entries?new=item"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface transition-colors"
                >
                  {t("activeTimers.newBillingItemButton")}
                </Link>
              </div>
            </div>

            {/* Each running timer is a full-width horizontal band: big digits on
                the leading (right) side, project/description/start in the middle,
                actions on the trailing (left) side. Multiple timers stack. */}
            <div className="space-y-3">
              {runningTimers.map((timer) => {
                const project = projects.find((p) => p.id === timer.projectId) ?? null;
                const isPaused = !!timer.pausedAt;
                return (
                  <div
                    key={timer.id}
                    className="bg-card border border-border/50 rounded-[var(--radius-card)] p-4 sm:p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6"
                  >
                    {/* Status + digits */}
                    <div className="flex flex-col gap-1 sm:min-w-[170px]">
                      <div className="flex items-center gap-2">
                        {isPaused ? (
                          <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
                            {t("activeTimers.statusPaused")}
                          </span>
                        ) : (
                          <>
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-running opacity-75" />
                              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-running" />
                            </span>
                            <span className="text-xs font-medium text-muted-foreground">{t("activeTimers.statusActive")}</span>
                          </>
                        )}
                      </div>
                      <p className="font-mono text-4xl sm:text-5xl font-bold tabular-nums leading-none text-primary">
                        {elapsedTimes[timer.id] ?? "0:00"}
                      </p>
                    </div>

                    {/* Meta */}
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
                      {project && (
                        <div className="flex items-center gap-2">
                          <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate font-medium text-foreground">{project.name}</span>
                        </div>
                      )}
                      {timer.description && (
                        <p className="line-clamp-1 text-muted-foreground">{timer.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4 shrink-0" />
                        <span>
                          {t("activeTimers.startedAt", {
                            time: new Date(timer.startTime).toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit" }),
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 sm:shrink-0">
                      {isPaused ? (
                        <button
                          onClick={() => handleResumeTimer(timer.id)}
                          disabled={resumingTimerId === timer.id}
                          className="flex-1 whitespace-nowrap rounded-md bg-success px-5 py-2.5 text-sm font-semibold text-success-foreground hover:bg-success/90 disabled:opacity-50 transition-colors sm:flex-initial"
                        >
                          {resumingTimerId === timer.id ? t("activeTimers.resumingButton") : t("activeTimers.resumeButton")}
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePauseTimer(timer.id)}
                          disabled={pausingTimerId === timer.id}
                          className="flex-1 whitespace-nowrap rounded-md bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors sm:flex-initial"
                        >
                          {pausingTimerId === timer.id ? t("activeTimers.pausingButton") : t("activeTimers.pauseButton")}
                        </button>
                      )}
                      <button
                        onClick={() => handleStopTimer(timer.id)}
                        className="flex-1 whitespace-nowrap rounded-md bg-destructive px-5 py-2.5 text-sm font-semibold text-white hover:bg-destructive/90 transition-colors sm:flex-initial"
                      >
                        {t("activeTimers.stopButton")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {/* Quick timer — start tracking time in one click */}
            <div className="bg-card border border-border/50 rounded-[var(--radius-card)] p-5 sm:p-6 relative overflow-hidden flex flex-col">
              <div className="absolute inset-0 flex items-center justify-end pe-8 pointer-events-none">
                <ClockFaceMarks size={120} className="opacity-[0.07]" />
              </div>
              <div className="relative flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-xl sm:text-2xl font-semibold text-foreground">{t("quickTimer.title")}</h3>
                  <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted border border-border rounded">T</kbd>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{t("quickTimer.subtitle")}</p>
              </div>
              <button
                onClick={() => setShowTimerModal(true)}
                className="relative mt-4 w-full rounded-md bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground hover:bg-primary/90 transition-all hover:shadow-md"
              >
                {t("quickTimer.startButton")}
              </button>
              {/* Manual time entry — a record entered by hand, no live timer */}
              <div className="relative mt-3 flex flex-wrap gap-2">
                <Link
                  href="/entries?new=manual"
                  className="inline-flex items-center rounded-[var(--radius)] border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface transition-colors"
                >
                  {t("quickTimer.manualEntryButton")}
                </Link>
              </div>
            </div>

            {/* Manual item — log billable work that wasn't timed (fixed sum or qty × rate) */}
            <div className="bg-card border border-border/50 rounded-[var(--radius-card)] p-5 sm:p-6 relative overflow-hidden flex flex-col">
              <div className="absolute inset-0 flex items-center justify-end pe-8 pointer-events-none">
                <ClockFaceMarks size={120} className="opacity-[0.07]" />
              </div>
              <div className="relative flex-1">
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-foreground">{t("billingItem.title")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t("billingItem.subtitle")}</p>
              </div>
              <Link
                href="/entries?new=item"
                className="relative mt-4 w-full rounded-md bg-primary px-8 py-4 text-center text-lg font-semibold text-primary-foreground hover:bg-primary/90 transition-all hover:shadow-md"
              >
                {t("billingItem.addButton")}
              </Link>
              {/* Invisible spacer keeps this CTA aligned with the timer/task cards' secondary-link row */}
              <div className="relative mt-3 h-10" aria-hidden="true" />
            </div>

            {/* Add task — create a task (client/project/rate) for the Kanban board */}
            <div className="bg-card border border-border/50 rounded-[var(--radius-card)] p-5 sm:p-6 relative overflow-hidden flex flex-col">
              <div className="absolute inset-0 flex items-center justify-end pe-8 pointer-events-none">
                <ClockFaceMarks size={120} className="opacity-[0.07]" />
              </div>
              <div className="relative flex-1">
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-foreground">{t("task.title")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t("task.subtitle")}</p>
              </div>
              <Link
                href="/tasks?create=true"
                className="relative mt-4 w-full rounded-md bg-primary px-8 py-4 text-center text-lg font-semibold text-primary-foreground hover:bg-primary/90 transition-all hover:shadow-md"
              >
                {t("task.createButton")}
              </Link>
              <div className="relative mt-3 flex flex-wrap gap-2">
                <Link
                  href="/tasks"
                  className="inline-flex items-center rounded-[var(--radius)] border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface transition-colors"
                >
                  {t("task.allTasksLink")}
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Charts Grid */}
        {!isFirstTimeUser && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EarningsChart data={monthlyEarnings} loading={statsLoading} />
            <ProjectHoursChart data={projectHours} loading={statsLoading} />
          </div>
        )}

        {/* Recent Entries */}
        {recentEntries.length > 0 && (
          <div className="mt-8">
            <h3 className="font-display text-xl font-semibold text-foreground mb-4">{t("recentEntries.title")}</h3>
            <div className="bg-card border border-border/50 rounded-[var(--radius-card)] shadow-sm overflow-hidden">
              <ul className="divide-y divide-border">
                {recentEntries.map((entry) => (
                  <li key={entry.id} className="px-6 py-4 hover:bg-muted transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{entry.description}</p>
                        <p className="text-sm text-muted-foreground">{new Date(entry.date).toLocaleDateString(intlLocale)}</p>
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
