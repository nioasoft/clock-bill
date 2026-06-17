"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/src/i18n/navigation";
import { AppLayout } from "@/components/app-layout";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Coins, Image as ImageIcon, TrendingUp } from "lucide-react";

interface SystemStats {
  topUsers: { userId: string; email: string; entryCount: number }[];
  projectStatuses: { status: string; count: number }[];
  currencies: { currency: string; count: number }[];
  avgEntriesPerUser: number;
  totalLogos: number;
}

export default function AdminStatsPage() {
  const t = useTranslations("Admin");
  const router = useRouter();
  const projectStatusLabels: Record<string, string> = {
    active: t("stats.projectStatus.active"),
    completed: t("stats.projectStatus.completed"),
    paused: t("stats.projectStatus.paused"),
    archived: t("stats.projectStatus.archived"),
  };
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/admin/system-stats");

        if (response.status === 403) {
          router.push("/dashboard");
          return;
        }

        const data = await response.json();
        if (data.success) {
          setStats(data.stats);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Error fetching system stats:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [router]);

  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title={t("stats.title")} subtitle={t("stats.subtitle")} />

        {loading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-[var(--radius-card)]" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-[var(--radius-card)] bg-destructive/10 p-6 text-center">
            <p className="text-destructive">{t("stats.loadError")}</p>
          </div>
        ) : stats ? (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
              <div className="bg-card border border-border/50 border-t-2 border-t-primary rounded-[var(--radius-card)] p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <p className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("stats.avgEntriesPerUser")}
                  </p>
                </div>
                <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-foreground">
                  {stats.avgEntriesPerUser}
                </p>
              </div>

              <div className="bg-card border border-border/50 border-t-2 border-t-accent rounded-[var(--radius-card)] p-4">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <p className="font-sans text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {t("stats.totalLogos")}
                  </p>
                </div>
                <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-foreground">
                  {stats.totalLogos}
                </p>
              </div>
            </div>

            {/* Top 10 Users */}
            <div className="rounded-[var(--radius-card)] bg-card border border-border/50 p-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h3 className="font-display text-lg font-semibold text-foreground">
                  {t("stats.topUsersTitle")}
                </h3>
              </div>
              <div className="space-y-3">
                {stats.topUsers.map((user, idx) => {
                  const maxEntries = stats.topUsers[0]?.entryCount || 1;
                  const width = (user.entryCount / maxEntries) * 100;
                  return (
                    <div key={user.userId} className="flex items-center gap-3">
                      <span className="text-sm font-mono text-muted-foreground w-6 text-center">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-foreground truncate">
                            {user.email}
                          </span>
                          <span className="text-sm font-mono tabular-nums text-muted-foreground ms-2">
                            {user.entryCount}
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary/70 rounded-full transition-all"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {stats.topUsers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">{t("stats.noData")}</p>
                )}
              </div>
            </div>

            {/* Project Status & Currency Distribution */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Project Statuses */}
              <div className="rounded-[var(--radius-card)] bg-card border border-border/50 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-5 w-5 text-secondary" />
                  <h3 className="font-display text-lg font-semibold text-foreground">
                    {t("stats.projectStatusTitle")}
                  </h3>
                </div>
                <div className="space-y-3">
                  {stats.projectStatuses.map((ps) => {
                    const total = stats.projectStatuses.reduce((s, p) => s + p.count, 0);
                    const pct = total > 0 ? ((ps.count / total) * 100).toFixed(0) : "0";
                    return (
                      <div key={ps.status} className="flex items-center justify-between">
                        <span className="text-sm text-foreground">
                          {projectStatusLabels[ps.status] || ps.status}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono tabular-nums text-muted-foreground">
                            {ps.count}
                          </span>
                          <span className="text-xs text-muted-foreground">({pct}%)</span>
                        </div>
                      </div>
                    );
                  })}
                  {stats.projectStatuses.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">{t("stats.noData")}</p>
                  )}
                </div>
              </div>

              {/* Currencies */}
              <div className="rounded-[var(--radius-card)] bg-card border border-border/50 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Coins className="h-5 w-5 text-accent" />
                  <h3 className="font-display text-lg font-semibold text-foreground">
                    {t("stats.currencyTitle")}
                  </h3>
                </div>
                <div className="space-y-3">
                  {stats.currencies.map((c) => {
                    const total = stats.currencies.reduce((s, cur) => s + cur.count, 0);
                    const pct = total > 0 ? ((c.count / total) * 100).toFixed(0) : "0";
                    return (
                      <div key={c.currency} className="flex items-center justify-between">
                        <span className="text-sm text-foreground">{c.currency}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono tabular-nums text-muted-foreground">
                            {c.count}
                          </span>
                          <span className="text-xs text-muted-foreground">({pct}%)</span>
                        </div>
                      </div>
                    );
                  })}
                  {stats.currencies.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">{t("stats.noData")}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </PageContainer>
    </AppLayout>
  );
}
