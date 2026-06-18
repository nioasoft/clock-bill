"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EarningsChart } from "@/components/earnings-chart";
import { ProjectHoursChart } from "@/components/project-hours-chart";
import { useNotifications } from "@/hooks/use-notifications";
import { useProfile } from "@/hooks/use-profile";
import { OnboardingModal } from "@/components/onboarding-modal";
import { useTimer } from "@/contexts/timer-context";
import { Users, FolderOpen, Clock, StickyNote, SlidersHorizontal } from "lucide-react";
import {
  DEFAULT_DASHBOARD_CONFIG,
  getWidgetMeta,
  normalizeDashboardConfig,
  type DashboardConfig,
} from "@/lib/dashboard-widgets";

// Count-aware grid classes for the stat-card row. Static full strings (not
// interpolated) so Tailwind v4's JIT can see them. Capped at 5 columns; more
// cards wrap to a second row.
const CARD_GRID_BY_COUNT: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
};

interface RevenueValue {
  amount: number;
  formatted: string;
}

interface PeriodRevenue extends RevenueValue {
  byHours?: RevenueValue;
  byItems?: RevenueValue;
}

interface DashboardStats {
  today: {
    hours: number;
    formatted: string;
    revenue?: PeriodRevenue;
  };
  week: {
    hours: number;
    formatted: string;
    revenue?: PeriodRevenue;
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
  formattedDuration: string | null;
  formattedAmount: string | null;
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
  // Reuses the timer-bar notes strings so the two editors stay in sync.
  const tTimer = useTranslations("Timer");
  const intlLocale = useLocale() === "en" ? "en-US" : "he-IL";
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);
  const [monthlyEarnings, setMonthlyEarnings] = useState<MonthlyEarnings[]>([]);
  const [projectHours, setProjectHours] = useState<ProjectHours[]>([]);
  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig>(DEFAULT_DASHBOARD_CONFIG);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Onboarding flag from the shared profile query (no separate /api/profile fetch).
  const { data: profile } = useProfile();
  useEffect(() => {
    if (profile && profile.onboarded === false) setShowOnboarding(true);
  }, [profile]);

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
    handleUpdateTimerNotes,
    onTimerStopped,
  } = useTimer();

  // Inline notes editor state for the active-timers band (same behavior as
  // the persistent timer bar's notes editor).
  const [notesEditorId, setNotesEditorId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const openNotesEditor = (id: string, current: string | null) => {
    setNotesEditorId((prev) => (prev === id ? null : id));
    setNotesDraft(current || "");
  };

  const saveNotes = async (id: string) => {
    setSavingNotes(true);
    const ok = await handleUpdateTimerNotes(id, notesDraft);
    setSavingNotes(false);
    if (ok) setNotesEditorId(null);
  };

  // Daily reminder notification
  const { checkDailyReminder } = useNotifications();

  // Fetch dashboard stats. `silent` skips the skeleton for background refreshes
  // (e.g. after a timer stops) so the numbers update in place without a flash.
  const fetchStats = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setStatsLoading(true);
      // no-store: iOS Safari (especially as an installed PWA) may otherwise
      // serve a cached body for the silent background refetches.
      const response = await fetch("/api/dashboard/stats", { cache: "no-store" });
      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
        setRecentEntries(data.recentEntries || []);
        setMonthlyEarnings(data.monthlyEarnings || []);
        setProjectHours(data.projectHours || []);
        // The API already normalizes; normalize again defensively so the page
        // always renders a complete, valid layout.
        setDashboardConfig(normalizeDashboardConfig(data.dashboardConfig));
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

  // On mobile the app often comes back from the background hours later with
  // stale numbers (iOS keeps the page alive). Re-fetch silently whenever the
  // tab becomes visible again, and on window focus (covers switching between
  // two visible desktop windows, where visibilitychange never fires).
  useEffect(() => {
    const refresh = () => fetchStats({ silent: true });
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, [fetchStats]);

  // The context polls /api/timer/running every 30s, so `runningTimers` reflects
  // stops/starts made in ANY tab or device. The onTimerStopped emit above only
  // covers a stop performed in THIS tab — here we also refetch whenever the set
  // of running timer ids actually changes (poll arrays are new refs each tick,
  // so compare by id signature, and skip the initial load).
  const runningIdsRef = useRef<string | null>(null);
  useEffect(() => {
    if (timerLoading) return;
    const ids = runningTimers.map((t) => t.id).sort().join(",");
    const prev = runningIdsRef.current;
    runningIdsRef.current = ids;
    if (prev !== null && prev !== ids) {
      fetchStats({ silent: true });
    }
  }, [runningTimers, timerLoading, fetchStats]);

  // Check for the daily reminder every minute — but only while the tab is
  // visible. A backgrounded tab stops the interval entirely (mirrors the timer
  // context) and re-checks the moment it's shown again, so we don't keep firing
  // on hidden tabs.
  useEffect(() => {
    if (!stats) return;
    const todayHours = stats.today.hours;

    let interval: ReturnType<typeof setInterval> | null = null;
    const startInterval = () => {
      if (interval === null) {
        interval = setInterval(() => checkDailyReminder(todayHours), 60000);
      }
    };
    const stopInterval = () => {
      if (interval !== null) {
        clearInterval(interval);
        interval = null;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkDailyReminder(todayHours);
        startInterval();
      } else {
        stopInterval();
      }
    };

    checkDailyReminder(todayHours);
    if (document.visibilityState === "visible") startInterval();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stopInterval();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [stats, checkDailyReminder]);

  const isFirstTimeUser = stats &&
    stats.clientsCount === 0 &&
    stats.projectsCount === 0 &&
    stats.today.hours === 0 &&
    stats.month.hours === 0;

  // ── Customizable layout ────────────────────────────────────────────────
  // The display value for each stat-card widget id. All values come from the
  // single /api/dashboard/stats response — no per-widget fetches.
  const cardValues: Record<string, string> = stats
    ? {
        hoursToday: stats.today.formatted,
        revenueToday: stats.today.revenue?.formatted ?? "—",
        revenueTodayByHours: stats.today.revenue?.byHours?.formatted ?? "—",
        revenueTodayByItems: stats.today.revenue?.byItems?.formatted ?? "—",
        hoursWeek: stats.week.formatted,
        revenueWeek: stats.week.revenue?.formatted ?? "—",
        revenueWeekByHours: stats.week.revenue?.byHours?.formatted ?? "—",
        revenueWeekByItems: stats.week.revenue?.byItems?.formatted ?? "—",
        hoursMonth: stats.month.formatted,
        revenueByHours: stats.earnings.byHours.formatted,
        revenueByItems: stats.earnings.byItems.formatted,
        revenueMonth: stats.earnings.formatted,
        clientsCount: String(stats.clientsCount),
        projectsCount: String(stats.projectsCount),
      }
    : {};

  const visibleCards = dashboardConfig.cards.filter(
    (c) => c.visible && cardValues[c.id] !== undefined
  );
  const cardGridClass =
    CARD_GRID_BY_COUNT[Math.min(visibleCards.length, 5)] ?? CARD_GRID_BY_COUNT[5];
  // Skeleton count tracks the saved layout (config is already loaded by then on
  // a warm cache; falls back to the default's visible count on first paint).
  const expectedCardCount = dashboardConfig.cards.filter((c) => c.visible).length || 5;

  const visibleSections = dashboardConfig.sections.filter((s) => s.visible);

  // Each lower section renders its own card; the two charts sit one-per-column
  // and recent-entries spans the full width — exactly the pre-customization
  // layout when all three are visible in default order.
  const renderSection = (id: string): ReactNode => {
    switch (id) {
      case "earningsChart":
        return <EarningsChart data={monthlyEarnings} loading={statsLoading} />;
      case "projectHours":
        return <ProjectHoursChart data={projectHours} loading={statsLoading} />;
      case "recentEntries":
        return recentEntries.length > 0 ? (
          <div>
            <h3 className="font-display text-xl font-semibold text-foreground mb-4">{t("recentEntries.title")}</h3>
            <div className="bg-card border border-border/50 rounded-[var(--radius-card)] overflow-hidden">
              <ul className="divide-y divide-border">
                {recentEntries.map((entry) => (
                  <li key={entry.id} className="px-6 py-4 hover:bg-muted transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{entry.description}</p>
                        <p className="text-sm text-muted-foreground">{new Date(entry.date).toLocaleDateString(intlLocale)}</p>
                      </div>
                      <div className="text-end">
                        <p className="font-mono text-sm font-medium tabular-nums text-foreground">
                          {entry.formattedAmount ?? entry.formattedDuration}
                        </p>
                        {entry.formattedAmount && entry.formattedDuration && (
                          <p className="font-mono text-xs tabular-nums text-muted-foreground">{entry.formattedDuration}</p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <AppLayout>
      {showOnboarding && <OnboardingModal onDone={() => setShowOnboarding(false)} />}
      <PageContainer>
        <PageHeader
          title={t("pageTitle")}
          subtitle={t("pageSubtitle")}
        >
          <Link
            href="/settings?tab=appearance"
            className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-border-strong transition-colors min-h-[44px]"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {t("customizeButton")}
          </Link>
        </PageHeader>

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

        {/* Stats Cards — order & visibility driven by the user's saved layout
            (dashboardConfig). RTL: first item renders rightmost. */}
        {statsLoading ? (
          <div className={`mt-5 grid gap-2 sm:gap-3 ${cardGridClass}`}>
            {Array.from({ length: expectedCardCount }).map((_, i) => (
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
        ) : stats && !isFirstTimeUser && visibleCards.length > 0 ? (
          <div className={`mt-5 grid gap-2 sm:gap-3 ${cardGridClass}`}>
            {visibleCards.map((card, index) => {
              const meta = getWidgetMeta(card.id);
              const accent = Boolean(meta?.accent);
              const label = meta ? t(meta.labelKey) : card.id;
              // Mobile: compact cards (tight padding, smaller digits); the
              // accent total spans both columns as a single label+value row.
              return (
                <div
                  key={card.id}
                  className={`rounded-[var(--radius-card)] border p-2.5 sm:p-4 transition-colors motion-safe:animate-fade-up stagger-${Math.min(index + 1, 5)} ${
                    accent
                      ? "col-span-2 order-first sm:order-none sm:col-span-1 bg-primary/[0.06] border-primary/25 hover:border-primary/40"
                      : "bg-card border-border hover:border-border-strong"
                  }`}
                >
                  <p className="text-[10px] sm:text-xs uppercase tracking-widest font-semibold text-muted-foreground">{label}</p>
                  <p className={`font-mono font-bold tabular-nums ${
                    accent
                      ? "mt-1 sm:mt-2 text-2xl text-primary"
                      : "mt-1 sm:mt-2 text-base sm:text-2xl text-foreground"
                  }`}>
                    {cardValues[card.id]}
                  </p>
                </div>
              );
            })}
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
            {/* Stacked on mobile so the buttons keep one-line labels. */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-display text-xl sm:text-2xl font-semibold text-foreground">
                {t("activeTimers.title")}
                {runningTimers.length > 1 && (
                  <span className="ms-2 inline-flex items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-sm font-semibold text-primary align-middle">
                    {runningTimers.length}
                  </span>
                )}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowTimerModal(true)}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Clock className="h-4 w-4" />
                  {t("activeTimers.newTimerButton")}
                </button>
                <Link
                  href="/entries?new=item"
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface transition-colors"
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
                const hasNotes = !!timer.notes;
                const editingNotes = notesEditorId === timer.id;
                return (
                  <div
                    key={timer.id}
                    className="bg-card border border-border/50 rounded-[var(--radius-card)] p-4 sm:p-5 flex flex-col gap-4"
                  >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
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
                      <button
                        onClick={() => openNotesEditor(timer.id, timer.notes)}
                        aria-label={hasNotes ? tTimer("bar.editNotes") : tTimer("bar.addNotes")}
                        title={hasNotes ? tTimer("bar.editNotes") : tTimer("bar.addNotes")}
                        className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-semibold transition-colors ${
                          hasNotes || editingNotes
                            ? "bg-primary/15 text-primary hover:bg-primary/25"
                            : "border border-border text-foreground hover:bg-muted"
                        }`}
                      >
                        <StickyNote className="h-4 w-4 shrink-0" />
                        <span className="hidden sm:inline">{hasNotes ? tTimer("bar.noteShort") : tTimer("bar.notes")}</span>
                      </button>
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
                        className="flex-1 whitespace-nowrap rounded-md bg-destructive px-5 py-2.5 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 transition-colors sm:flex-initial"
                      >
                        {t("activeTimers.stopButton")}
                      </button>
                    </div>
                  </div>

                  {/* Inline notes editor — same flow as the timer bar's. */}
                  {editingNotes && (
                    <div className="border-t border-border/50 pt-3">
                      <label htmlFor={`band-timer-notes-${timer.id}`} className="mb-1 block text-xs font-medium text-muted-foreground">
                        {tTimer("bar.notesLabel")}
                      </label>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                        <textarea
                          id={`band-timer-notes-${timer.id}`}
                          rows={2}
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          placeholder={tTimer("bar.notesPlaceholder")}
                          autoFocus
                          className="flex-1 resize-y rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                        <div className="flex shrink-0 gap-2 sm:flex-col">
                          <button
                            onClick={() => saveNotes(timer.id)}
                            disabled={savingNotes}
                            className="flex-1 sm:flex-initial rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 min-h-[40px]"
                          >
                            {savingNotes ? tTimer("bar.saving") : tTimer("bar.save")}
                          </button>
                          <button
                            onClick={() => setNotesEditorId(null)}
                            disabled={savingNotes}
                            className="flex-1 sm:flex-initial rounded-[var(--radius)] border border-border px-4 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50 min-h-[40px]"
                          >
                            {tTimer("bar.cancel")}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-6">
            {/* One consolidated quick-actions card. The persistent timer bar (and
                the T shortcut) are the primary way to start a timer; this card is
                the discoverable entry point for the common create actions. */}
            <div className="bg-card border border-border/50 rounded-[var(--radius-card)] p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-xl sm:text-2xl font-semibold text-foreground">{t("quickActions.title")}</h3>
                <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted border border-border rounded">T</kbd>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{t("quickActions.subtitle")}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => setShowTimerModal(true)}
                  className="inline-flex items-center rounded-[var(--radius)] bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  {t("quickTimer.startButton")}
                </button>
                <Link
                  href="/entries?new=item"
                  className="inline-flex items-center rounded-[var(--radius)] border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface transition-colors"
                >
                  {t("billingItem.addButton")}
                </Link>
                <Link
                  href="/tasks?create=true"
                  className="inline-flex items-center rounded-[var(--radius)] border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface transition-colors"
                >
                  {t("task.createButton")}
                </Link>
                <Link
                  href="/entries?new=manual"
                  className="inline-flex items-center rounded-[var(--radius)] px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-surface hover:text-foreground transition-colors"
                >
                  {t("quickTimer.manualEntryButton")}
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Lower sections — order & visibility from the saved layout. Charts
            take one column each; recent-entries spans the full width. */}
        {!isFirstTimeUser && visibleSections.length > 0 && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {visibleSections.map((section) => {
              const node = renderSection(section.id);
              if (!node) return null;
              return (
                <div
                  key={section.id}
                  className={section.id === "recentEntries" ? "lg:col-span-2" : undefined}
                >
                  {node}
                </div>
              );
            })}
          </div>
        )}
      </PageContainer>
    </AppLayout>
  );
}
