"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration } from "@/lib/format";

interface ReconciliationData {
  date: string;
  entryCount: number;
  minutes: number;
  runningTimerCount: number;
  unloggedCompletedTasks: Array<{ id: string; title: string; projectName: string }>;
}

type State = "loading" | "ready" | "error";

export function DailyReconciliation({ onLogWork }: { onLogWork: () => void }) {
  const t = useTranslations("Entries.reconciliation");
  const locale = useLocale();
  const [state, setState] = useState<State>("loading");
  const [data, setData] = useState<ReconciliationData | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const response = await fetch("/api/reconciliation/today");
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error("load failed");
      setData(json.data as ReconciliationData);
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (state === "loading") {
    return <div className="mb-5 rounded-[var(--radius-card)] border border-border bg-card p-4" aria-hidden="true"><Skeleton className="h-5 w-40" /><Skeleton className="mt-3 h-4 w-64" /></div>;
  }

  if (state === "error") {
    return (
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">{t("error")}</p>
        <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4" aria-hidden="true" />{t("retry")}</Button>
      </div>
    );
  }

  if (!data) return null;
  const needsAttention = data.runningTimerCount > 0 || data.unloggedCompletedTasks.length > 0;

  return (
    <section className={`mb-5 rounded-[var(--radius-card)] border p-4 sm:p-5 ${needsAttention ? "border-warning/30 bg-warning/5" : "border-success/25 bg-success/5"}`} aria-labelledby="daily-reconciliation-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          {needsAttention ? <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />}
          <div className="min-w-0">
            <h2 id="daily-reconciliation-title" className="font-semibold text-foreground">{needsAttention ? t("attentionTitle") : t("completeTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("summary", { count: data.entryCount, duration: formatDuration(data.minutes, locale) })}</p>
          </div>
        </div>
        {needsAttention && <Button onClick={onLogWork}>{t("logWork")}</Button>}
      </div>

      {needsAttention && (
        <div className="mt-4 grid gap-2 border-t border-border/60 pt-4 sm:grid-cols-2">
          {data.runningTimerCount > 0 && (
            <div className="flex min-h-11 items-center gap-2 rounded-[var(--radius)] bg-card px-3 py-2 text-sm text-foreground"><Clock3 className="h-4 w-4 text-warning" aria-hidden="true" />{t("runningTimers", { count: data.runningTimerCount })}</div>
          )}
          {data.unloggedCompletedTasks.map((task) => (
            <button key={task.id} type="button" onClick={onLogWork} className="min-h-11 rounded-[var(--radius)] bg-card px-3 py-2 text-start text-sm transition-colors hover:bg-card-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="block truncate font-medium text-foreground"><bdi>{task.title}</bdi></span>
              <span className="block truncate text-xs text-muted-foreground"><bdi>{task.projectName}</bdi> · {t("missingEntry")}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
