"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/src/i18n/navigation";
import { Link } from "@/src/i18n/navigation";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, FileText, Activity, UserPlus, FolderKanban, BarChart3 } from "lucide-react";

interface AdminStats {
  totalUsers: number;
  newToday: number;
  totalEntries: number;
  entriesToday: number;
  activeTimers: number;
  newThisWeek: number;
  newThisMonth: number;
  totalProjects: number;
  registrationTrend: { day: string; count: number }[];
}

export default function AdminDashboardPage() {
  const t = useTranslations("Admin");
  const intlLocale = useLocale() === "en" ? "en-US" : "he-IL";
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Check admin access
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        if (!sessionData.success || sessionData.user?.role !== "admin") {
          router.push("/dashboard");
          return;
        }

        const response = await fetch("/api/admin/stats");
        const data = await response.json();

        if (data.success) {
          setStats(data.stats);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Error fetching admin stats:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [router]);

  const maxTrend = stats
    ? Math.max(...stats.registrationTrend.map((d) => d.count), 1)
    : 1;

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title={t("dashboard.title")}
          subtitle={t("dashboard.subtitle")}
        />

        {/* Stat Cards */}
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-card border border-border/50 rounded-[var(--radius-card)] p-4 shadow-sm">
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-8 w-3/4" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[var(--radius-card)] bg-destructive/10 p-6 text-center">
            <p className="text-destructive">{t("dashboard.loadError")}</p>
          </div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="bg-card border border-border/50 border-t-2 border-t-primary rounded-[var(--radius-card)] p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <p className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("dashboard.totalUsers")}
                  </p>
                </div>
                <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-foreground">{stats.totalUsers}</p>
                {stats.newToday > 0 && (
                  <p className="mt-1 text-xs text-success">{t("dashboard.newTodayDelta", { count: stats.newToday })}</p>
                )}
              </div>

              <div className="bg-card border border-border/50 border-t-2 border-t-primary rounded-[var(--radius-card)] p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <p className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("dashboard.totalEntries")}
                  </p>
                </div>
                <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-foreground">{stats.totalEntries}</p>
                {stats.entriesToday > 0 && (
                  <p className="mt-1 text-xs text-success">{t("dashboard.newTodayDelta", { count: stats.entriesToday })}</p>
                )}
              </div>

              <div className="bg-card border border-border/50 border-t-2 border-t-accent rounded-[var(--radius-card)] p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <p className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("dashboard.activeTimers")}
                  </p>
                </div>
                <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-foreground">{stats.activeTimers}</p>
              </div>

              <div className="bg-card border border-border/50 border-t-2 border-t-secondary rounded-[var(--radius-card)] p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                  <p className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("dashboard.newThisWeek")}
                  </p>
                </div>
                <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-foreground">{stats.newThisWeek}</p>
              </div>

              <div className="bg-card border border-border/50 border-t-2 border-t-secondary rounded-[var(--radius-card)] p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                  <p className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("dashboard.newThisMonth")}
                  </p>
                </div>
                <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-foreground">{stats.newThisMonth}</p>
              </div>

              <div className="bg-card border border-border/50 border-t-2 border-t-accent rounded-[var(--radius-card)] p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-muted-foreground" />
                  <p className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("dashboard.totalProjects")}
                  </p>
                </div>
                <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-foreground">{stats.totalProjects}</p>
              </div>
            </div>

            {/* Registration Trend Chart */}
            {stats.registrationTrend.length > 0 && (
              <div className="mt-6 rounded-[var(--radius-card)] bg-card border border-border/50 p-6 shadow-sm">
                <h3 className="font-display text-lg font-semibold text-foreground mb-4">
                  {t("dashboard.registrationsTrend")}
                </h3>
                <div className="h-48 flex items-end gap-1">
                  {stats.registrationTrend.map((d) => {
                    const height = (d.count / maxTrend) * 100;
                    const dateStr = new Date(d.day).toLocaleDateString(intlLocale, {
                      day: "numeric",
                      month: "numeric",
                    });
                    return (
                      <div
                        key={d.day}
                        className="flex-1 flex flex-col items-center gap-1"
                        title={t("dashboard.registrationsTooltip", { date: dateStr, count: d.count })}
                      >
                        <span className="text-[10px] text-muted-foreground">{d.count}</span>
                        <div
                          className="w-full bg-primary/80 rounded-t-sm min-h-[2px] transition-all"
                          style={{ height: `${Math.max(height, 2)}%` }}
                        />
                        <span className="text-[9px] text-muted-foreground rotate-[-45deg] origin-top-right whitespace-nowrap">
                          {dateStr}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Links */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Link
                href="/admin/users"
                className="bg-card border border-border/50 rounded-[var(--radius-card)] p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <h3 className="font-display text-lg font-semibold text-foreground">{t("dashboard.usersLinkTitle")}</h3>
                    <p className="text-sm text-muted-foreground">{t("dashboard.usersLinkSubtitle")}</p>
                  </div>
                </div>
              </Link>
              <Link
                href="/admin/stats"
                className="bg-card border border-border/50 rounded-[var(--radius-card)] p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-5 w-5 text-accent" />
                  <div>
                    <h3 className="font-display text-lg font-semibold text-foreground">{t("dashboard.statsLinkTitle")}</h3>
                    <p className="text-sm text-muted-foreground">{t("dashboard.statsLinkSubtitle")}</p>
                  </div>
                </div>
              </Link>
            </div>
          </>
        ) : null}
      </PageContainer>
    </AppLayout>
  );
}
