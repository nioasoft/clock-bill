"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";

interface DueClient {
  clientId: string;
  clientName: string;
  currency: string;
  unbilledTotal: number;
  amountLabel: string;
  billingDay: number;
  daysOverdue: number;
}

type State = "loading" | "ready" | "error";

/**
 * Dashboard section listing clients whose settlement day has passed and that
 * have unbilled work. Renders null when there is nothing due (the dashboard
 * section wrapper skips null nodes), so it only appears when actionable.
 */
export function SettlementsDueCard() {
  const t = useTranslations("Dashboard");
  const [state, setState] = useState<State>("loading");
  const [clients, setClients] = useState<DueClient[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/settlements/due");
        const json = await res.json();
        if (!active) return;
        if (!res.ok || !json.success) { setState("error"); return; }
        setClients(json.data.clients as DueClient[]);
        setState("ready");
      } catch {
        if (active) setState("error");
      }
    })();
    return () => { active = false; };
  }, []);

  if (state === "loading") {
    return (
      <div className="bg-card border border-border/50 rounded-[var(--radius-card)] p-6">
        <div className="h-5 w-40 bg-muted rounded animate-pulse mb-4" />
        <div className="h-12 w-full bg-muted rounded animate-pulse" />
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="bg-card border border-border/50 rounded-[var(--radius-card)] p-6">
        <h3 className="font-display text-xl font-semibold text-foreground mb-2">{t("settlementsDue.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("settlementsDue.error")}</p>
      </div>
    );
  }
  // Nothing due → return null so the section wrapper collapses cleanly.
  if (clients.length === 0) return null;

  return (
    <div className="bg-card border border-border/50 rounded-[var(--radius-card)] overflow-hidden">
      <h3 className="font-display text-xl font-semibold text-foreground px-6 pt-6 pb-2">{t("settlementsDue.title")}</h3>
      <ul className="divide-y divide-border">
        {clients.map((c) => (
          <li key={c.clientId} className="px-6 py-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{c.clientName}</p>
              <p className="text-xs text-muted-foreground">
                {c.daysOverdue > 0
                  ? t("settlementsDue.overdueDays", { days: c.daysOverdue })
                  : t("settlementsDue.dueToday")}
              </p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <span className="font-mono text-sm font-medium tabular-nums text-foreground">{c.amountLabel}</span>
              <Link
                href="/reports"
                className="text-sm font-medium text-primary hover:underline min-h-[44px] flex items-center"
              >
                {t("settlementsDue.createDocument")}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
